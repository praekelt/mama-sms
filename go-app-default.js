var go = {};
go;

go.SECONDS_IN_A_DAY = 24 * 60 * 60;
go.MILLISECONDS_IN_A_DAY = go.SECONDS_IN_A_DAY * 1000;
go.MILLISECONDS_IN_A_WEEK = go.MILLISECONDS_IN_A_DAY * 7;

go.utils = {

  month_of_year_to_week: function(month) {
    var m = parseInt(month, 10);
    var current_date = this.get_current_date();
    var present_year = current_date.getFullYear();
    var present_month = current_date.getMonth();

    // 9 month cut off for rolling over into next year.
    var year_offset = (m < present_month && (present_month - m) > 3)
              ? 1 : 0;

    var birth_date = new Date(Date.UTC(present_year + year_offset, m, 15));
    var check_poll_number = this.get_poll_number(birth_date);
    if (check_poll_number < 1) {
      var corrected_date = birth_date - ((1 - check_poll_number) * go.MILLISECONDS_IN_A_WEEK);
      birth_date = new Date(corrected_date + new Date().getTimezoneOffset());
    }
    return birth_date;
  },

  months_to_week: function(month) {
    var m = parseInt(month, 10);
    var week = (m - 1) * 4 + 1;
    var current_date = this.get_current_date();
    var birth_date = new Date(current_date - (week * go.MILLISECONDS_IN_A_WEEK));
    return birth_date;
  },

  get_current_date: function() {
    return new Date();
  },

  get_today_as_string: function() {
    var today_iso = this.get_current_date().toISOString();
    return today_iso.split('T')[0];
  },

  get_holodeck_timestamp: function() {
    // NOTE:  this is why any datestamp format other than ISO8601
    //      is a bad idea.
    var today = this.get_current_date().toISOString();
    var parts = today.split('T');
    var date = parts[0];
    var hms = parts[1].split('.')[0];
    return date + " " + hms;
  },

  get_last_monday: function(date) {
    var current_date = date || this.get_current_date();
    var offset = current_date.getDay() - 1 || 7;
    var monday = current_date - (offset * go.MILLISECONDS_IN_A_DAY);
    return new Date(monday);
  },

  calculate_weeks_remaining: function(birth_date) {
    var milliseconds_to_go = birth_date - this.get_last_monday();
    return Math.floor(milliseconds_to_go / go.MILLISECONDS_IN_A_WEEK);
  },

  get_poll_number: function(birth_date) {
    var weeks_to_go = this.calculate_weeks_remaining(birth_date);
    return 36 - weeks_to_go;
  },

  get_dob_for_user_status: function(im) {
    var user = im.user,
        user_status = user.get_answer('user_status');
    var dob;
    switch(user_status) {
      case 'pregnant':
        dob = this.month_of_year_to_week(user.get_answer('expected_month')).toISOString();
        break;
      case 'baby':
        dob = this.months_to_week(user.get_answer('initial_age')).toISOString();
        break;
      default:
        dob = 'unknown';
        break;
    }
    return dob;
  },

  get_seq_send_keys: function(im) {
    if(!im.config.sequential_send_keys) {
      return [];
    }
    return im.config.sequential_send_keys.map(function(key) {
      return 'scheduled_message_index_' + key;
    });
  },

  'bloody trailing': 'commas'
};

var Q = require('Q');

go.METRICS_PUSH_DATE = 'metrics_push_date';

go.metrics = {
  publish_daily_stats: function (im) {
    // check if metrics need to be skipped
    if(im.config.qa || im.config.skip_holodeck) {
      return Q(true);
    }

    var today = go.utils.get_today_as_string();

    return im
      .api_request('kv.get', { key: go.METRICS_PUSH_DATE })
      .get('value')
      .then(function (last_push_date) {
        if(last_push_date != today) {
          return go.metrics
              .publish_stats(im)
              .then(function () {
                return im.api_request('kv.set', {
                  key: go.METRICS_PUSH_DATE,
                  value: today
                });
              });
        }
      });
  },

  publish_stats: function (im) {
    return Q(true)
      .then(function () {
        return go.metrics.publish_group_counts(im, {
          group_name: im.config.group_name || 'Registered Users',
          metric_name: 'registered_users'
        });
      })
      .then(function () {
        return go.metrics.publish_uniques_counts(im, {
          conversation_key: im.config.conversation_key,
          metric_name: 'unique_msisdns'
        });
      })
      .then(function () {
        return go.metrics.publish_inbound_message_counts(im, {
          conversation_keys: (
            im.config.sequential_send_keys.concat(im.config.extra_sms_stat_keys || [])),
          metric_name: 'inbound_message_count'
        });
      })
      .then(function () {
        return go.metrics.publish_outbound_message_counts(im, {
          conversation_keys: (
            im.config.sequential_send_keys.concat(im.config.extra_sms_stat_keys || [])),
          metric_name: 'outbound_message_count'
        });
      });
  },

  get_metric_name: function (im, name) {
    return [im.config.metric_prefix, name].join('.');
  },

  publish_group_counts: function(im, opts) {
    return this
      .get_group_count(im, opts.group_name)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_name), count);
      });
  },

  publish_uniques_counts: function(im, opts) {
    return this
      .get_uniques_count(im, opts.conversation_key)
      .then(function (count) {
        return im
          .metrics.fire.max(go.metrics.get_metric_name(im, opts.metric_name), count);
      });
  },

  publish_inbound_message_counts: function (im, opts) {
    return Q.all(opts.conversation_keys.map(function (conversation_key) {
      return im.api_request('messagestore.count_replies', {
        conversation_key: conversation_key
      }).get('count');
    }))
      .then(function (counts) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            go.metrics.sum(counts));
      });
  },

  publish_outbound_message_counts: function (im, opts) {
    return Q.all(opts.conversation_keys.map(function (conversation_key) {
      return im.api_request('messagestore.count_sent_messages', {
        conversation_key: conversation_key
      }).get('count');
    }))
      .then(function (counts) {
        return im
          .metrics.fire.max(
            go.metrics.get_metric_name(im, opts.metric_name),
            go.metrics.sum(counts));
      });
  },

  sum: function (values) {
    return values.reduce(function (previous, current) {
      return previous + current;
    }, 0);
  },

  get_group_count: function(im, group_name) {
      return im
        .groups.get(group_name)
        .then(function (group) {
          return im.groups.sizeOf(group);
        });
  },

  get_uniques_count: function (im, conversation_key) {
    return im
      .api_request('messagestore.count_outbound_uniques', {
        conversation_key: conversation_key
      }).get('count');
  },

  'bloody': 'commas'
};

go.app = function() {

  var vumigo = require('vumigo_v02');
  var App = vumigo.App;

  var GoMAMA = App.extend(function(self) {
    App.call(self, 'states_start');
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
    var EndState = vumigo.states.EndState;
    var Q = require('q');

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

    self.states.add('expected_month', function (name, opts) {
      return new PaginatedChoiceState(name, {
        question: $('In what month is your baby due?'),
        choices: [
          // Javascript months are counted from zero.
          new Choice(0, $('Jan')),
          new Choice(1, $('Feb')),
          new Choice(2, $('Mar')),
          new Choice(3, $('Apr')),
          new Choice(4, $('May')),
          new Choice(5, $('Jun')),
          new Choice(6, $('Jul')),
          new Choice(7, $('Aug')),
          new Choice(8, $('Sep')),
          new Choice(9, $('Oct')),
          new Choice(10, $('Nov')),
          new Choice(11, $('Dec')),
          new Choice('unknown', $('Don\'t know'))
        ],
        options_per_age: 7,
        next: function (choice) {
          if(choice.value == 'unknown') {
            return 'go_to_clinic';
          }
          return self.im.config.skip_hiv_messages ? 'close' : 'hiv_messages';
        }
      });
    });

    self.states.add('go_to_clinic', self.make_fake_exit_menu({
      next: 'states_start',
      text: $("To sign up, we need to know which month. Please go to the clinic to " +
              "find out, and dial us again.")
    }));

    self.states.add('initial_age', function (name, opts) {
      return new ChoiceState(name, {
        question: $('How many months old is your baby?'),
        choices: [
            new Choice(1, '1'),
            new Choice(2, '2'),
            new Choice(3, '3'),
            new Choice(4, '4'),
            new Choice(5, '5'),
            new Choice(6, '6'),
            new Choice(7, '7'),
            new Choice(8, '8'),
            new Choice(9, '9'),
            new Choice(10, '10'),
            new Choice(11, $('11 or more'))
        ],
        next: function (choice) {
          if(choice.value == 11) {
            return 'too_old';
          }
          return self.im.config.skip_hiv_messages ? 'close' : 'hiv_messages';
        }
      });
    });

    self.states.add('too_old', self.make_fake_exit_menu({
      next: 'states_start',
      text: $("MAMA SMSs are aimed at mothers of younger babies. You can " +
             "visit askmama.mobi to read useful info, and meet other moms. " +
             "Stay well.")
    }));

    self.states.add('hiv_messages', function (name, opts) {
      return new ChoiceState(name, {
        question: $(
          'If you are HIV+ you can get SMSes with extra info for HIV+ moms. ' +
          'They may mention your status. Or, you can choose general SMSes only.'),
        choices: [
          new Choice('hiv', $('HIV')),
          new Choice('general', $('General'))
        ],
        next: 'close'
      });
    });

    self.states.add('missed_period', function (name, opts) {
      return new ChoiceState(name, {
        question: $(
          'If you have missed a period and have 1 or more of these, do a ' +
          'pregnancy test: nausea or vomiting; tender breasts; often tired.'),
        choices: [
          new Choice('more', $('Read more'))
        ],
        next: 'get_tested'
      });
    });

    self.states.add('get_tested',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $(
          "Don't wait! The 1st pregnancy check-up must happen soon. " +
          "Do the test as soon as possible at a clinic, " +
          "or get 1 at a pharmacy.")
      }));

    self.states.add('close', function (name, opts) {
      return Q(true)
        .then(function () {
          // Send welcome SMS if configured
          if(self.im.config.welcome_sms_copy) {
            return self.im.outbound.send_to_user({
              endpoint: 'sms',
              content: self.im.config.welcome_sms_copy
            });
          }
        })
        .then(function () {
          // Save information on the contact
          return self.im.contacts
            .for_user()
            .then(function(contact) {
              var user = self.im.user;
              var dob = go.utils.get_dob_for_user_status(self.im);
              contact.extra['mama-sms-user-status'] = user.get_answer('user_status');
              contact.extra['mama-sms-dob'] = dob;
              contact.extra['mama-sms-language'] = (
                self.im.config.default_language || user.get_answer('language_selection'));
              contact.extra['mama-sms-hiv-messages'] = (
                self.im.config.skip_hiv_messages ? 'general' : user.get_answer('hiv_messages'));
              contact.extra['mama-sms-registration-date'] = go.utils.get_current_date().toISOString();

              // set the sequential send keys
              var seq_send_keys = go.utils.get_seq_send_keys(self.im);
              seq_send_keys.forEach(function(key) {
                  contact.extra[key] = Number(go.utils.get_poll_number(new Date(dob))).toString();
              });

              return self.im.contacts.save(contact);
            });
        })
        .then(function () {
          return go.metrics.publish_daily_stats(self.im);
        })
        .then(function () {
          // delegate to the end state
          return self.states.create('end');
        });
    });

    self.states.add('end',
      self.make_fake_exit_menu({
        next: 'states_start',
        text: $('Thanks for joining MAMA. We\'ll start SMSing you this week.')
      }));
  });

  return {
    GoMAMA: GoMAMA
  };

}();

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoMAMA = go.app.GoMAMA;


    return {
        im: new InteractionMachine(api, new GoMAMA())
    };
}();
