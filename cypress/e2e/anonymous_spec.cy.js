describe('Anonymous user spec', () => {
  before(() => {
    cy.logout();
  });

  it('vists home page and sees welcome message', () => {
    cy.visit('/');

    cy.get('h1').contains('Welcome to Archivium').should('exist');
    cy.get('.navbarBtnLink').contains('Log In').should('have.attr', 'href', '/login');
    cy.get('main .navbarBtnLink').contains('Create Account').should('have.attr', 'href', '/signup?page=%2Funiverses%2Fcreate');
  });

  it('vists unprotected pages and doesn\'t get redirected', () => {
    const pages = [
      '/universes',
      '/search',
      '/universes/public-test-universe',
      '/universes/public-test-universe/items',
      '/universes/public-test-universe/items/test-article',
      '/universes/public-test-universe/items/test-character',
    ];
    for (const page of pages) {
      cy.visit(page);
      cy.url().should('include', Cypress.config().baseUrl + page);
      cy.get('.error').should('not.exist');
    }
  });

  it('vists protected pages and gets redirected', () => {
    const pages = [
      '/contacts',
      '/universes/create',
      '/universes/public-test-universe/items/create',
      '/editor/universes/public-test-universe/items/test-parent',
      '/universes/chatroom/discuss/create'
    ];
    for (const page of pages) {
      cy.visit(page);
      cy.url().should('include', Cypress.config().baseUrl + '/login');
    }
  });

  it('checks that new item buttons are not visible', () => {
    cy.visit('/universes/public-test-universe');

    cy.get('.item-type a').contains('Characters').parent().parent().parent().contains('New').should('not.exist');
  });
});
