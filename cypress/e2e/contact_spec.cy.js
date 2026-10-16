const card = (username) => `.contact-card[data-user="${username}"]`;

describe('Contacts spec', () => {
  it('sends some contact requests', () => {
    cy.login('testuser');
    cy.get('.navbar').contains('Contacts').click();

    cy.intercept('POST', '/api/contacts').as('request');
    for (const user of ['writer', 'reader', 'commenter']) {
      cy.get('#username').type(`test${user}`);
      cy.contains('Add Contact').click();
      cy.wait('@request');

      cy.get('#username').should('have.value', '');
      cy.get(card(`test${user}`)).should('contain', 'Pending');
    }
  });

  it('rejects contact request from admin, then sends a request back', () => {
    cy.login('testuser');
    cy.get('.navbar').contains('Contacts').click();

    cy.intercept('PUT', '/api/contacts').as('reject');
    cy.get(card('testadmin')).contains('Reject').click();
    cy.wait('@reject');
    cy.get(card('testadmin')).should('not.exist');

    cy.intercept('POST', '/api/contacts').as('request');
    cy.get('#username').type('testadmin');
    cy.contains('Add Contact').click();
    cy.wait('@request');
    cy.get(card('testadmin')).should('contain', 'Pending');
  });

  it('logs in as the other users and accepts the contact requests', () => {
    for (const user of ['writer', 'reader', 'commenter', 'admin']) {
      cy.login(`test${user}`);
      cy.get('.navbar').contains('Contacts').click();

      cy.intercept('PUT', '/api/contacts').as('accept');
      cy.get(card('testuser')).contains('Accept').click();
      cy.wait('@accept');
      cy.get(card('testuser')).should('not.contain', 'Accept');
    }
  });

  it('sees the requests are accepted, then removes them', () => {
    cy.login('testuser');
    cy.get('.navbar').contains('Contacts').click();

    for (const user of ['writer', 'reader', 'commenter', 'admin']) {
      cy.get(card(`test${user}`)).should('exist').and('not.contain', 'Pending');

      cy.intercept('DELETE', '/api/contacts').as('remove');
      cy.get(card(`test${user}`)).contains('delete').click();
      cy.wait('@remove');

      cy.get(card(`test${user}`)).should('not.exist');
    }
  });

  it('logs in as admin, sends a contact request and sees it is pending', () => {
    cy.login('testadmin');
    cy.get('.navbar').contains('Contacts').click();

    cy.intercept('POST', '/api/contacts').as('request');
    cy.get('#username').type('testuser');
    cy.contains('Add Contact').click();
    cy.wait('@request');

    cy.get(card('testuser')).should('contain', 'Pending');
  });
});
