describe('Universe spec', () => {
  beforeEach(() => {
    cy.login('testadmin');
  });

  it('tries to create duplicate universe, sees error messsage', () => {
    cy.visit('/universes/create');

    cy.get('#title').type('Duplicate Test Universe');
    cy.get('#shortname').type('public-test-universe');
    cy.get('button[type="submit"]').click();
    cy.get('.color-error').contains('universe.shortname must be unique.').should('exist');
  });

  it('edits the public universe title and types', () => {
    cy.visit('/universes/public-test-universe');

    cy.get('#info-bar').contains('Edit').click();

    cy.get('#title').clear().type('Alternate Title');

    // Remove all 9 item types
    for (let i = 0; i < 9; i++) {
      cy.get('#cats button').contains('Remove').click();
    }

    cy.get('#save-btn').click();

    // Confirm that title has been changed and that all item types have been removed
    cy.get('h1').contains('Private Test Universe').should('not.exist');
    cy.get('h1').contains('Alternate Title').should('exist');
    cy.get('.tabs [data-tab=items]').should('have.text', 'No item types have been defined yet — go to the edit page to add some.');

    cy.get('#info-bar').contains('Edit').click();

    // Add a new item type
    cy.contains('Add type').parent().as('newType');
    cy.get('@newType').find('[name=title]').type('test');
    cy.get('@newType').find('[name=titlePl]').type('tests');
    cy.get('@newType').find('button').click();
    cy.get('#save-btn').click();

    // Confirm that the new type exists
    cy.get('.item-type a').contains('Tests').should('exist');
  });

  it('restores the original title and types for the public universe', () => {
    cy.visit('/universes/public-test-universe');

    cy.get('#info-bar').contains('Edit').click();

    cy.get('#title').clear().type('Public Test Universe');
    cy.get('#cats button').contains('Reset to default types').click();

    cy.get('#save-btn').click();
  });

  it('removes and then restores an author of the public universe', () => {
    cy.visit('/universes/public-test-universe');
    cy.get('#info-bar').contains('Set Permissions').click();

    cy.get('form').contains('testwriter').parent().find('select').select('0');
    cy.get('#breadcrumbs').contains('Public Test Universe').click();

    cy.get('#tabBtns').contains('Authors').click();
    cy.get('.tabs [data-tab=authors] .card').contains('testwriter').should('not.exist');

    cy.get('#info-bar').contains('Set Permissions').click();

    cy.get('form').contains('testwriter').parent().find('select').select('3');
    cy.get('#breadcrumbs').contains('Public Test Universe').click();

    cy.get('#tabBtns').contains('Authors').click();
    cy.get('.tabs [data-tab=authors] .card').contains('testwriter').should('exist');
  });

  it('removes and restores an author of the private universe', () => {
    cy.visit('/universes/private-test-universe');
    cy.get('#info-bar').contains('Set Permissions').click();

    cy.get('form').contains('testwriter').parent().find('select').select('0');
    cy.get('#breadcrumbs').contains('Private Test Universe').click();

    cy.get('#tabBtns').contains('Authors').click();
    cy.get('.tabs [data-tab=authors] .card').contains('testwriter').should('not.exist');

    cy.visit('/universes/private-test-universe');
    cy.get('#info-bar').contains('Set Permissions').click();

    cy.get('form').contains('testwriter').parent().find('select').select('3');
    cy.get('#breadcrumbs').contains('Private Test Universe').click();

    cy.get('#tabBtns').contains('Authors').click();
    cy.get('.tabs [data-tab=authors] .card').contains('testwriter').should('exist');
  });

  it('creates new private universe and adds a viewer', () => {
    cy.visit('/universes');
    cy.get('a').contains('Create New').click();

    cy.get('h2').contains('New Universe').should('exist');

    cy.get('#title').type('Cypress Universe');
    cy.get('#shortname').type('cypress-universe');
    cy.get('#visibility').select('private');
    cy.get('#discussion_enabled').select('disabled');
    cy.get('#discussion_open').select('disabled');

    cy.get('button[type="submit"]').click();

    cy.get('h1').contains('Cypress Universe').should('exist');
    cy.get('#info-bar').contains('Set Permissions').click();

    cy.intercept('POST', '/universes/cypress-universe/permissions').as('setperms');
    cy.get('form').contains('testreader').parent().find('select').select('1');
    cy.wait('@setperms');
    cy.get('#breadcrumbs').contains('Cypress Universe').click();

    cy.get('#tabBtns').contains('Viewers').click();
    cy.get('.tabs [data-tab=viewers] .card').contains('testreader').should('exist');
  });

  it('checks the universe list as test reader, sees the universe', () => {
    cy.login('testreader');
    cy.visit('/universes');
    cy.get('.card-list .card h3').contains('Cypress Universe').should('exist');
  });

  it('removes the reader, the reader can no longer see the universe', () => {
    cy.visit('/universes/cypress-universe');
    cy.get('#info-bar').contains('Set Permissions').click();

    cy.intercept('POST', '/universes/cypress-universe/permissions').as('setperms');
    cy.get('form').contains('testreader').parent().find('select').select('0');
    cy.wait('@setperms');

    cy.login('testreader');
    cy.visit('/universes');
    cy.get('.card-list .card h3').contains('Cypress Universe').should('not.exist');
  });

  it('anonymous users cannot see the private universe', () => {
    cy.logout();
    cy.visit('/universes');
    cy.get('.card-list .card h3').contains('Cypress Universe').should('not.exist');
  });

  it('makes the universe public, the reader can see the universe again', () => {
    cy.visit('/universes/cypress-universe');
    cy.get('#info-bar').contains('Edit').click();

    cy.get('#visibility').select('public');
    cy.get('#save-btn').click();

    cy.login('testreader');
    cy.visit('/universes');
    cy.get('.card-list .card h3').contains('Cypress Universe').should('exist');
  });

  it('anonymous users can see the now public universe', () => {
    cy.logout();
    cy.visit('/universes');
    cy.get('.card-list .card h3').contains('Cypress Universe').should('exist');
  });

  it('deletes the new universe', () => {
    cy.visit('/universes/cypress-universe');

    cy.get('h1').contains('Cypress Universe').should('exist');
    cy.get('#info-bar').contains('Delete').click();

    cy.get('#shortname').type('cypress-universe');
    cy.get('button').contains('Delete Universe').click();

    cy.url().should('eq', Cypress.config().baseUrl + '/universes');

    cy.get('.card-list .card h3').contains('Cypress Universe').should('not.exist');
  });
});
    