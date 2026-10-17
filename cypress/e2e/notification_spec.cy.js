describe('Notification spec', () => {
  it('marks any old notifications as read', () => {
    cy.login('testadmin');

    cy.visit('/notifications');
    cy.get('#unread-notifications').then((unread) => {
      const unreadNotifCount = unread.children().length;
      cy.get('#read-notifications').then((read) => {
        const readNotifCount = read.children().length;
        cy.get('a').contains('Mark all as read').click();
        cy.get('#unread-notifications').children().should('have.length', 0);
        cy.get('#read-notifications').children().should('have.length', unreadNotifCount + readNotifCount);
      });
    });

    cy.login('testuser');
    cy.visit('/notifications');
    cy.get('a').contains('Mark all as read').click();
  });

  it('disables notifications', () => {
    cy.login('testadmin');

    cy.visit('/settings');
    cy.get('#tabBtns [data-tab=notifications]').click();
    cy.get('#notif_contacts_0').uncheck();
    cy.get('#notificationSettings').contains('Update Preferences').click();

    cy.login('testuser');

    cy.visit('/settings');
    cy.get('#tabBtns [data-tab=notifications]').click();
    cy.get('#notif_contacts_0').uncheck();
    cy.get('#notificationSettings').contains('Update Preferences').click();
  });

  it('rejects and then re-sends a contact request between admin and user, no notifications are seen', () => {
    cy.login('testuser');
    cy.get('.navbar').contains('Contacts').click();
    
    cy.intercept('PUT', '/api/contacts').as('reject');
    cy.get('.contact-card[data-user="testadmin"]').contains('Reject').click();
    cy.wait('@reject');

    cy.login('testadmin');
    cy.visit('/notifications');
    cy.get('#unread-notifications').children().should('have.length', 0);
    
    cy.login('testadmin');
    cy.get('.navbar').contains('Contacts').click();

    cy.intercept('POST', '/api/contacts').as('request');
    cy.get('#username').type('testuser');
    cy.contains('Add Contact').click();
    cy.wait('@request');

    cy.login('testuser');
    cy.visit('/notifications');
    cy.get('#unread-notifications').children().should('have.length', 0);
  });

  it('re-enables notifications', () => {
    cy.login('testadmin');

    cy.visit('/settings');
    cy.get('#tabBtns [data-tab=notifications]').click();
    cy.get('#notif_contacts_0').check();
    cy.get('#notificationSettings').contains('Update Preferences').click();

    cy.login('testuser');

    cy.visit('/settings');
    cy.get('#tabBtns [data-tab=notifications]').click();
    cy.get('#notif_contacts_0').check();
    cy.get('#notificationSettings').contains('Update Preferences').click();
  });

  it('rejects admin\'s contact request, admin sees the notification', () => {
    cy.login('testuser');
    cy.get('.navbar').contains('Contacts').click();
    
    cy.intercept('PUT', '/api/contacts').as('reject');
    cy.get('.contact-card[data-user="testadmin"]').contains('Reject').click();
    cy.wait('@reject');

    cy.login('testadmin');
    cy.visit('/notifications');
    cy.get('#unread-notifications').children().should('have.length', 1);
    cy.get('#unread-notifications').children().contains('Contact Request Rejected');
  });

  it('sends another contact request, user sees the notification and marks it as read', () => {
    cy.login('testadmin');
    cy.get('.navbar').contains('Contacts').click();

    cy.intercept('POST', '/api/contacts').as('request');
    cy.get('#username').type('testuser');
    cy.contains('Add Contact').click();
    cy.wait('@request');

    cy.login('testuser');
    cy.visit('/notifications');
    cy.get('#unread-notifications').children().should('have.length', 1);
    cy.get('#unread-notifications').children().contains('Contact Request');
    cy.get('a').contains('drafts').click();
    cy.get('#unread-notifications').children().should('have.length', 0);
  });
});
