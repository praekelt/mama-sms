go.app = function() {

  var vumigo = require('vumigo_v02');
  var App = vumigo.App;

  var GoMAMA = App.extend(function(self) {
    App.call(self, 'states_start');
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;

    var $ = self.$;

    self.make_fake_exit_menu = function(opts) {
      /*
      NOTE:

      This is required because in some scenarios this application is launched
      from an STK. Some phones' STK environments swallow the closing response
      we send via USSD. This isn't anything we control, it's a result of the
      STK standard being unclear about what STK implementers should do with a
      "close" response. As a result some phones show the closing text, others
      do not.

      This fake exit menu adds an extra screen to make the UX of this a bit
      less painful.

      Standard ->

        +-------------+
        | opts.text   | -> ... opts.next
        +-------------+

      Fake exit ->

       +-------------+    +------------+
       | opts.text   | -> | Thank you  | -> ... opts.next
       |             |    | Good bye   |
       | 1. Exit     |    |            |
       +-------------+    +------------+

      Now phones _without_ the quirk will be showing the 'Thank you Good bye'
      screen while phones _with_ the quirk will still provide the opportunity
      for users to understand that they've closed the session and it did
      not time out.
      */
      return function(name, creator_opts) {
        if (self.im.config.stk_fake_exit) {
          return new ChoiceState(name, {
            question: opts.text,
            choices: [
              new Choice('1', $('Exit'))
            ],
            next: {
              name: 'stk_end',
              creator_opts: opts
            }
          });
        }
        return new EndState(name, opts);
      };
    };

    self.states.add('stk_end', function (name, opts) {
      return new EndState(name, {
        text: $('Thank you, good bye.'),
        next: 'states_start'
      });
    });

    self.states.add('states_start', function (name, opts) {
      return self.im.api_request('optout.status', {
        address_type: "msisdn",
        address_value: self.im.user.addr
      }).then(function (result) {
        if(result.opted_out) {
          return self.states.create('opted_out');
        } else if (self.im.config.default_language) {
          return self.states.create('default_language');
        } else {
          return self.states.create('language_selection');
        }
      });
    });

    self.states.add('opted_out', function (name, opts) {
      return new ChoiceState(name, {
        question: $('You have previously opted-out of this service. ' +
                    'Do you want to opt-back in again?'),
        choices: [
          new Choice('yes', 'Yes please.'),
          new Choice('no', 'No thank you.')
        ],
        next: function (choice) {
          return choice.value == 'yes' ? 'opt_back_in' : 'remain_opted_out';
        }
      });
    });

    self.states.add('opt_back_in', function (name, opts) {
      return self.im.api_request('optout.cancel_optout', {
        address_type: 'msisdn',
        address_value: self.im.user.addr,
        message_id: self.im.msg.message_id
      }).then(function (result) {
        return new ChoiceState(name, {
          question: $('You have opted-back in to MAMA. Press 1 to continue.'),
          choices: [
            new Choice('1', 'Continue')
          ],
          next: 'states_start'
        });
      });
    });

    self.states.add('remain_opted_out',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $('You remain opted-out of MAMA.')
      })
    );

    self.states.add('language_selection', function (name, opts) {
      return new ChoiceState(name, {
        question: (
          self.im.config.custom_opening_copy || $(
          'To get MAMA messages, we need to ask you 4 questions. ' +
          'What language would you like?')),
        choices: [
          new Choice('english', 'English'),
          new Choice('zulu', 'Zulu'),
          new Choice('xhosa', 'Xhosa'),
          new Choice('afrikaans', 'Afrikaans'),
          new Choice('sotho', 'Sotho'),
          new Choice('setswana', 'Setswana')
        ],
        next: 'user_status'
      });
    });

    self.states.add('default_language', function (name, opts) {
      return new ChoiceState(name, {
        question: (
          self.im.config.custom_opening_copy || $(
            'To get MAMA messages, we need to ask you 2 questions. ' +
            'Would you like to continue and answer these?')),
        choices: [
          new Choice('yes', $('Yes please')),
          new Choice('no', $('No thanks'))
        ],
        next: function(choice) {
          return {
            'yes': 'user_status',
            'no': 'cancel'
          }[choice.value];
        }
      });
    });

    self.states.add('cancel',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $("To receive MAMA SMSs you will need to answer the questions.")
      })
    );

    self.states.add('user_status', function (name, opts) {
      return new ChoiceState(name, {
        question: $('Are you pregnant, or do you have a baby?'),
        choices: [
          new Choice('pregnant', $('Pregnant')),
          new Choice('baby', $('Baby')),
          new Choice('unknown', $('Don\'t know'))
        ],
        next: function (choice) {
          return {
            'pregnant': 'expected_month',
            'baby': 'initial_age',
            'unknown': 'missed_period'
          }[choice.value];
        }
      });
    });

  });

  return {
    GoMAMA: GoMAMA
  };

}();
