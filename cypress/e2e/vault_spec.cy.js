const UNIVERSE = 'public-test-universe';
const VAULT = 'cypress-vault';
const VAULT_TITLE = 'Cypress Vault';
const ITEM = 'cypress-vaulted-item';
const ITEM_TITLE = 'Cypress Vaulted Item';

function openVaultsTab() {
  cy.visit(`/universes/${UNIVERSE}`);
  cy.get('#action-bar').contains('Admin Menu').click();
  cy.get('#tabBtns').contains('Vaults').click();
}

function vaultRow(username) {
  return cy.get(`form[data-vault="${VAULT}"]`).contains(username).parent();
}

describe('Vault spec', () => {
  beforeEach(() => {
    cy.login('testadmin');
  });

  it('creates a vault, deriving the shortname from the title', () => {
    openVaultsTab();

    cy.intercept('POST', `/api/universes/${UNIVERSE}/vaults`).as('createVault');
    cy.get('#create_vault input[name="title"]').type(VAULT_TITLE);
    cy.get('#create_vault input[name="shortname"]').should('have.value', VAULT);
    cy.get('#create_vault button[type="submit"]').click();
    cy.wait('@createVault');

    cy.get('#tabBtns').contains('Vaults').click();
    cy.get('h2').contains(VAULT_TITLE).should('exist');
    cy.contains('a', '(0 items)').should('exist');
  });

  it('lists the universe owner as an inherited owner with a locked dropdown', () => {
    openVaultsTab();

    cy.contains('b', 'Owner (2)').should('exist');

    vaultRow('testadmin').find('select').should('not.be.disabled');

    vaultRow('testowner').should('contain', '(universe owner)');
    vaultRow('testowner').find('select').should('be.disabled');
    vaultRow('testowner').find('select').should('have.value', '5');
  });

  it('lets the universe owner administer a vault they were never granted', () => {
    cy.login('testowner');
    openVaultsTab();

    cy.get('h2').contains(VAULT_TITLE).should('exist');
    cy.get(`button.delete_vault[data-vault="${VAULT}"]`).should('exist');
  });

  it('does not offer the vault to a writer with no grant when creating an item', () => {
    cy.login('testwriter');
    cy.visit(`/universes/${UNIVERSE}/items/create`);

    cy.get('#vault').should('not.exist');
  });

  it('creates an item inside the vault', () => {
    cy.visit(`/universes/${UNIVERSE}/items/create`);

    cy.get('#vault option:selected').should('have.text', 'None');

    cy.get('#title').type(ITEM_TITLE);
    cy.get('#shortname').should('have.value', ITEM);
    cy.get('#item_type').select('character');
    cy.get('#vault').select(VAULT_TITLE);
    cy.get('button[type="submit"]').click();

    cy.url().should('include', `/universes/${UNIVERSE}/items/${ITEM}`);
    cy.get('h1').contains(ITEM_TITLE).should('exist');
  });

  it('counts the vaulted item in the admin menu and links to the filtered list', () => {
    openVaultsTab();

    cy.contains('a', '(1 item)')
      .should('have.attr', 'href')
      .and('include', `/items?vault=${VAULT}`);
  });

  it('shows the vault on the item page', () => {
    cy.visit(`/universes/${UNIVERSE}/items/${ITEM}`);

    cy.get('#breadcrumbs').contains('a', VAULT_TITLE)
      .should('have.attr', 'href')
      .and('include', `/items?vault=${VAULT}`);

    // The subtitle names the vault instead of the universe, with the universe below it.
    cy.contains('p', `of ${VAULT_TITLE}`).should('exist');
    cy.contains('p', '(Public Test Universe)').should('exist');
  });

  it('filters the item list down to the vault', () => {
    cy.visit(`/universes/${UNIVERSE}/items?vault=${VAULT}`);

    cy.get('h1').should('contain', `of ${VAULT_TITLE}`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('exist');
    // test-character is in the universe but not in the vault.
    cy.get('.card-list .card h3').contains('Test Character').should('not.exist');
  });

  it('hides the vaulted item from a writer without a grant', () => {
    cy.login('testwriter');

    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('not.exist');

    cy.request({ url: `/api/universes/${UNIVERSE}/items/${ITEM}`, failOnStatusCode: false })
      .its('status').should('eq', 403);
  });

  it('hides the vaulted item from anonymous users even though the universe is public', () => {
    cy.logout();

    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('not.exist');

    cy.request({ url: `/api/universes/${UNIVERSE}/items/${ITEM}`, failOnStatusCode: false })
      .its('status').should('eq', 401);

    cy.request({ url: `/universes/${UNIVERSE}/items?vault=${VAULT}`, failOnStatusCode: false, followRedirect: false })
      .its('status').should('eq', 302);
  });

  it('shows the vaulted item to the universe owner with no explicit grant', () => {
    cy.login('testowner');

    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('exist');
  });

  it('grants the writer read access to the vault', () => {
    openVaultsTab();

    cy.intercept('PUT', `/api/universes/${UNIVERSE}/vaults/${VAULT}/perms`).as('setVaultPerms');
    cy.get(`form.vault_invite[data-vault="${VAULT}"] input[name="username"]`).type('testwriter');
    cy.get(`form.vault_invite[data-vault="${VAULT}"] select[name="new_permission_level"]`).select('1');
    cy.get(`form.vault_invite[data-vault="${VAULT}"] button[type="submit"]`).click();
    cy.wait('@setVaultPerms');

    cy.get('#tabBtns').contains('Vaults').click();
    cy.contains('b', 'Read (1)').should('exist');
    vaultRow('testwriter').find('select').should('have.value', '1');
  });

  it('shows the vaulted item to the writer once granted', () => {
    cy.login('testwriter');

    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('exist');
  });

  it('read access to a vault is not write access to its items', () => {
    cy.login('testwriter');

    cy.request({
      method: 'PUT',
      url: `/api/universes/${UNIVERSE}/items/${ITEM}`,
      body: { title: ITEM_TITLE, obj_data: {} },
      failOnStatusCode: false,
    }).its('status').should('eq', 403);
  });

  it('offers only writable vaults in the editor dropdown', () => {
    cy.intercept('GET', `/api/universes/${UNIVERSE}/items/${ITEM}`).as('loadItem');
    cy.visit(`/editor/universes/${UNIVERSE}/items/${ITEM}`);
    cy.wait('@loadItem');

    cy.get('#vault_short option:not([hidden])').should('have.length', 2);
    cy.get('#vault_short option:not([hidden])').first().should('have.text', 'None');
    cy.get('#vault_short option:selected').should('have.text', VAULT_TITLE);
  });

  it('moves the item out of the vault from the editor', () => {
    cy.intercept('GET', `/api/universes/${UNIVERSE}/items/${ITEM}`).as('loadItem');
    cy.visit(`/editor/universes/${UNIVERSE}/items/${ITEM}`);
    cy.wait('@loadItem');

    cy.get('#vault_short').select('None');
    cy.wait(600);
    cy.get('#save-btn').click();

    // Now unvaulted, so the public universe exposes it to anonymous visitors again.
    cy.logout();
    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('exist');
  });

  it('moves the item back into the vault from the editor', () => {
    cy.intercept('GET', `/api/universes/${UNIVERSE}/items/${ITEM}`).as('loadItem');
    cy.visit(`/editor/universes/${UNIVERSE}/items/${ITEM}`);
    cy.wait('@loadItem');

    cy.get('#vault_short').select(VAULT_TITLE);
    cy.wait(600);
    cy.get('#save-btn').click();

    cy.logout();
    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('not.exist');
  });

  it('revokes the writer\'s grant, hiding the item again', () => {
    openVaultsTab();

    cy.intercept('PUT', `/api/universes/${UNIVERSE}/vaults/${VAULT}/perms`).as('setVaultPerms');
    vaultRow('testwriter').find('select').select('0');
    cy.wait('@setVaultPerms');

    cy.login('testwriter');
    cy.visit(`/universes/${UNIVERSE}/items`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('not.exist');
  });

  it('keeps the vault UI out of reach of non-admins', () => {
    cy.login('testwriter');

    cy.visit(`/universes/${UNIVERSE}`);
    cy.get('#action-bar').contains('Admin Menu').should('not.exist');

    cy.request({ url: `/universes/${UNIVERSE}/admin`, failOnStatusCode: false })
      .its('status').should('eq', 403);

    cy.request({ url: `/universes/${UNIVERSE}/items?vault=${VAULT}`, failOnStatusCode: false })
      .its('status').should('eq', 403);
  });

  it('refuses to delete a vault that still contains items', () => {
    cy.login('testowner');
    openVaultsTab();

    cy.intercept('DELETE', `/api/universes/${UNIVERSE}/vaults/${VAULT}`).as('deleteVault');
    cy.get(`button.delete_vault[data-vault="${VAULT}"]`).click();
    cy.wait('@deleteVault').its('response.statusCode').should('eq', 400);

    cy.get(`.vault_error[data-vault="${VAULT}"]`)
      .should('contain', `Cannot delete ${VAULT_TITLE} while it still contains 1 item`);

    cy.get('h2').contains(VAULT_TITLE).should('exist');
    cy.visit(`/universes/${UNIVERSE}/items?vault=${VAULT}`);
    cy.get('.card-list .card h3').contains(ITEM_TITLE).should('exist');
  });

  it('deletes the item and then the vault', () => {
    cy.login('testowner');

    cy.visit(`/universes/${UNIVERSE}/items/${ITEM}`);
    cy.get('#action-bar').contains('Delete').click();
    cy.get('#shortname').type(ITEM);
    cy.get('button').contains('Delete Item').click();

    openVaultsTab();
    cy.intercept('DELETE', `/api/universes/${UNIVERSE}/vaults/${VAULT}`).as('deleteVault');
    cy.get(`button.delete_vault[data-vault="${VAULT}"]`).click();
    cy.wait('@deleteVault');

    cy.get('#tabBtns').contains('Vaults').click();
    cy.get('h2').contains(VAULT_TITLE).should('not.exist');
  });
});
