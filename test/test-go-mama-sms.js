var fs = require("fs");
var assert = require("assert");
var vumigo = require("vumigo_v01");
var app = require("../lib/go-mama-sms");

var success = vumigo.promise.success;

// This just checks that you hooked you InteractionMachine
// up to the api correctly and called im.attach();
describe("test api", function() {
    it("should exist", function() {
        assert.ok(app.api);
    });
    it("should have an on_inbound_message method", function() {
        assert.ok(app.api.on_inbound_message);
    });
    it("should have an on_inbound_event method", function() {
        assert.ok(app.api.on_inbound_event);
    });
});


var assert_single_sms = function(to_addr, content) {
    var teardown = function(api) {
        var sms = api.outbound_sends[0];
        assert.equal(api.outbound_sends.length, 1);
        assert.equal(sms.to_addr, to_addr);
        assert.ok(sms.content.match(content));
    };
    return teardown;
};

var assert_no_sms = function() {
    var teardown = function(api) {
        assert.equal(api.outbound_sends.length, 0);
    };
    return teardown;
};

var fixtures = [
    'test/fixtures/holodeck-sms-messaging-types.json',
    'test/fixtures/holodeck-sms-users.json',
    'test/fixtures/holodeck-ussd-messaging-types.json',
    'test/fixtures/holodeck-ussd-message-counts.json',
    'test/fixtures/holodeck-sms-message-counts.json',
    'test/fixtures/holodeck-ussd-users.json'
];

var setup_groups = function(app, api) {
    app.api.add_group({
        key: app.api.im.state_creator.SMS_HIV_GROUP_KEY,
        query: 'all people in HIV group'
    });

    api.add_group({
        key: app.api.im.state_creator.SMS_STD_GROUP_KEY,
        query: 'all people in STD group'
    });

    app.api.add_group({
        key: app.api.im.state_creator.USSD_HIV_GROUP_KEY,
        query: 'all people in HIV group'
    });

    api.add_group({
        key: app.api.im.state_creator.USSD_STD_GROUP_KEY,
        query: 'all people in STD group'
    });

    api.add_group({
        key: app.api.im.state_creator.USSD_GROUP_KEY,
        query: 'all people in USSD app'
    });

    api.add_group({
        key: app.api.im.state_creator.SMS_GROUP_KEY,
        query: 'all people in SMS app'
    });

    // prime the smart group population
    api.set_smart_group_query_results(
        'all people in HIV group', ['contact-foo', 'contact-bar']);

    api.set_smart_group_query_results(
        'all people in STD group', ['contact-baz']);

    api.set_smart_group_query_results(
        'all people in USSD app', ['contact-baz']);

    api.set_smart_group_query_results(
        'all people in SMS app', ['contact-baz']);
};

var setup_api = function(api) {

    /* opt-out stubbery */
    api.optout_store = [];
    api.optout = function (address_type, address_value) {
        var key = address_type + ':' + address_value;
        api.optout_store.push(key);
    };

    api._handle_optout_status = function (cmd, reply) {
        var key = cmd.address_type + ':' + cmd.address_value;
        reply(api._populate_reply(cmd, {
            success: true,
            opted_out: api.optout_store.indexOf(key) >= 0,
            created_at: new Date().toISOString(),
            message_id: 'the-message-id'
        }));
    };

    api._handle_optout_cancel_optout = function (cmd, reply) {
        var key = cmd.address_type + ':' + cmd.address_value;
        var index = api.optout_store.indexOf(key);
        if(index > -1) {
            api.optout_store.splice(index, 1);
        }
        reply(api._populate_reply(cmd, {
            success: true,
            opted_out: false
        }));
    };

    api._handle_messagestore_count_outbound_uniques = function (cmd, reply) {
        return reply(api._populate_reply(cmd, {
            success: true,
            count: 10
        }));
    };

    api._handle_messagestore_count_replies = function (cmd, reply) {
        return reply(api._populate_reply(cmd, {
            success: true,
            count: 5
        }));
    };

    api._handle_messagestore_count_sent_messages = function (cmd, reply) {
        return reply(api._populate_reply(cmd, {
            success: true,
            count: 3
        }));
    };
};

describe('MAMA SMS from an STK', function () {
    var tester;
    var config = {
        'skip_hiv_messages': true,
        'custom_opening_copy': 'Foo bar baz',
        'stk_fake_exit': true,
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'extra_sms_stat_keys': [],
        'sms_tag': ['pool', 'tag'],
        'default_language': 'english',
        'welcome_sms_copy': (
            "You signed up to get MAMA SMSs, every Monday & Thursday around 9am. " +
            "To stop SMSs, send a call-me to 071 166 7783. (We won't call you back, " +
            "SMS will just stop.)")
    };

    beforeEach(function() {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {
                api.config_store.config = JSON.stringify(config);

                fixtures.forEach(function(f) {
                    api.load_http_fixture(f);
                });

                setup_groups(app, api);
                setup_api(api);
            },
            async: true
        });

        // patch the date functions to return predictable dates
        var state_creator = app.api.im.state_creator;
        state_creator.get_current_date = function() {
            return new Date(2013, 6, 17); // July == 6
        };
        state_creator.get_last_monday = function() {
            return new Date(2013, 6, 15); // July == 6
        };
    });

    it('should show a fake exit before the real end', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'hiv_messages',
                answers: {
                    user_status: 'baby',
                    initial_age: '2'
                }
            },
            content: '1',
            next_state: 'end',
            response: (
                'Thanks for joining MAMA. We\'ll start SMSing you this week.[^]' +
                '1. Exit'
            ),
            teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs')
        }).then(done, done);
    });

    it('should show the real end screen when replying to the fake exit', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'end'
            },
            content: '1',
            next_state: 'stk_end',
            response: 'Thank you, good bye.',
            continue_session: false
        }).then(done, done);
    });

    it('should allow for custom opening copy', function (done) {
        var p = tester.check_state({
            user: null,
            content: null,
            next_state: 'language_selection',
            response: (
                '^Foo bar baz[^]' +
                '1. Yes please[^]' +
                '2. No thanks$'),
            continue_session: true
        }).then(done, done);
    });

    it('should allow skipping the HIV option', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'initial_age',
                answers: {
                    'user_status': 'baby'
                }
            },
            content: '2',
            next_state: 'end',
            response: '^Thanks for joining MAMA.',
            continue_session: true
        }).then(done, done);
    });
});

describe("Mama SMS application in a default language", function() {

    var tester;
    var config = {
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'extra_sms_stat_keys': [],
        'sms_tag': ['pool', 'tag'],
        'default_language': 'english',
        'welcome_sms_copy': (
            "You signed up to get MAMA SMSs, every Monday & Thursday around 9am. " +
            "To stop SMSs, send a call-me to 071 166 7783. (We won't call you back, " +
            "SMS will just stop.)")
    };

    beforeEach(function() {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {
                api.config_store.config = JSON.stringify(config);

                fixtures.forEach(function(f) {
                    api.load_http_fixture(f);
                });

                setup_groups(app, api);
                setup_api(api);
            },
            async: true
        });

        // patch the date functions to return predictable dates
        var state_creator = app.api.im.state_creator;
        state_creator.get_current_date = function() {
            return new Date(2013, 6, 17); // July == 6
        };
        state_creator.get_last_monday = function() {
            return new Date(2013, 6, 15); // July == 6
        };
    });

    it('should not ask for a language selection', function(done) {
        var p = tester.check_state({
            user: null,
            content: null,
            next_state: 'language_selection',
            response: (
                '^To get MAMA messages, we need to ask you 3 questions. '+
                'Would you like to continue and answer these\\?[^]' +
                '1. Yes please[^]' +
                '2. No thanks$'),
            continue_session: true
        }).then(done, done);
    });

    it('should allow for ending the menu if not wanting to answer the questions', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'opt_status'
            },
            content: '2',
            next_state: 'cancel',
            response: (
                '^To receive MAMA SMSs you will need to answer the questions.$'),
            continue_session: false
        }).then(done, done);
    });

    it('should store the default language', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'hiv_messages',
                answers: {
                    user_status: 'baby',
                    initial_age: '2'
                }
            },
            content: '1',
            next_state: 'end',
            response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
            teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
            continue_session: false
        }).then(function() {
            var contact = app.api.find_contact('sms', '+1234567');
            assert.equal(contact['extras-mama-sms-user-status'], 'baby');
            var dob = new Date(contact['extras-mama-sms-dob']);
            assert.equal(dob.getFullYear(), 2013);
            assert.equal(dob.getMonth(), 5); // June, baby is in its second month
            assert.equal(contact['extras-mama-sms-hiv-messages'], 'hiv');
            // check we've got the default language
            assert.equal(contact['extras-mama-sms-language'], 'english');
        }).then(done, done);
    });

});

describe("Mama SMS application in multiple language", function() {

    var tester;
    var config = {
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'extra_sms_stat_keys': [],
        'sms_tag': ['pool', 'tag'],
        'welcome_sms_copy': (
            "You signed up to get MAMA SMSs, every Monday & Thursday around 9am. " +
            "To stop SMSs, send a call-me to 071 166 7783. (We won't call you back, " +
            "SMS will just stop.)")
    };

    beforeEach(function() {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {
                api.config_store.config = JSON.stringify(config);

                fixtures.forEach(function(f) {
                    api.load_http_fixture(f);
                });

                setup_groups(app, api);
                setup_api(api);
            },
            async: true
        });

        // patch the date functions to return predictable dates
        var state_creator = app.api.im.state_creator;
        state_creator.get_current_date = function() {
            return new Date(2013, 6, 17); // July == 6
        };
        state_creator.get_last_monday = function() {
            return new Date(2013, 6, 15); // July == 6
        };
    });

    describe('when dealing with pregnant women', function() {

        it('should begin asking for the language selection', function(done) {
            var p = tester.check_state({
                user: null,
                content: null,
                next_state: 'language_selection',
                response: '^To get MAMA messages, we need to ask you 4 questions',
                continue_session: true
            }).then(done, done);
        });

        it('should ask them for the user status', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'language_selection'
                },
                content: '2',
                next_state: 'user_status',
                response: '^Are you pregnant, or do you have a baby\\?',
                continue_session: true
            }).then(done, done);
        });

        it('should ask them the due date if expecting a baby', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'user_status',
                    answers: {
                        'user_status': 'pregnant',
                        'language_selection': 'sotho'
                    }
                },
                content: '1',
                next_state: 'expected_month',
                response: 'In what month is your baby due?',
                continue_session: true
            }).then(done, done);
        });

        it('should allow them to opt in for general or hiv messaging', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'expected_month',
                    answers: {
                        'user_status': 'pregnant'
                    }
                },
                content: '1',
                next_state: 'hiv_messages',
                response: '^If you are HIV\\+ you can get SMSes',
                continue_session: true
            }).then(done, done);
        });

        it('should close off with a thank you message', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'pregnant',
                        expected_month: '2'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(done, done);
        });

        it('should tell them to visit a clinic if they don\'t know the age', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'expected_month',
                    answers: {
                        user_status: 'pregnant'
                    }
                },
                content: '13',
                next_state: 'go_to_clinic',
                response: 'To sign up, we need to know which month.',
                continue_session: false
            }).then(done, done);
        });
        it('should calculate the birth date based on gestational age', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'pregnant',
                        expected_month: '7',
                        language_selection: 'sotho'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(function() {
                var contact = app.api.find_contact('sms', '+1234567');
                assert.equal(contact['extras-mama-sms-user-status'], 'pregnant');
                var dob = new Date(contact['extras-mama-sms-dob']);
                assert.equal(dob.getFullYear(), 2013);
                assert.equal(dob.getMonth(), 7); // August
                assert.equal(contact['extras-mama-sms-hiv-messages'], 'hiv');
                assert.equal(contact['extras-mama-sms-language'], 'sotho');
            }).then(done, done);
        });
        it('should store the correct poll number for the given dob', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'pregnant',
                        expected_month: '7'
                    }
                },
                content: '1',
                next_state: 'end',
                response: '^Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(function() {
                var contact = app.api.find_contact('sms', '+1234567');
                config['sequential_send_keys'].forEach(function(key) {
                    assert.equal(
                        contact['extras-scheduled_message_index_' + key],
                        '32');
                });
            }).then(done, done);
        });
        it('should capture the registration date', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'pregnant',
                        expected_month: '7'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(function() {
                var contact = app.api.find_contact('sms', '+1234567');
                var reg_date = new Date(contact['extras-mama-sms-registration-date']);
                assert.equal(
                    reg_date.toString(),
                    app.api.im.state_creator.get_current_date().toString());
            }).then(done, done);
        });
    });

    describe('when dealing with parents', function() {
        it('should allow them to choose language preference', function(done) {
            var p = tester.check_state({
                user: null,
                content: null,
                next_state: 'language_selection',
                response: '^To get MAMA messages, we need to ask you 4 questions',
                continue_session: true
            }).then(done, done);
        });
        it('should ask them the age of the baby', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'user_status',
                    answers: {
                        'user_status': 'baby'
                    }
                },
                content: '2',
                next_state: 'initial_age',
                response: '^How many months old is your baby\\?',
                continue_session: true
            }).then(done, done);
        });

        it('should allow them to opt in for general or hiv messaging', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'initial_age',
                    answers: {
                        'user_status': 'baby'
                    }
                },
                content: '1',
                next_state: 'hiv_messages',
                response: '^If you are HIV\\+ you can get SMSes',
                continue_session: true
            }).then(done, done);
        });
        it('should close off with a thank you message', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        'user_status': 'baby',
                        'initial_age': '1'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(done, done);
        });
        it('should only offer content for babies up until 10 months old', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'initial_age',
                    answers: {
                        user_status: 'baby'
                    }
                },
                content: '11',
                next_state: 'too_old',
                response: 'Sorry, MAMA SMSs are aimed at mothers of younger babies',
                continue_session: false
            }).then(done, done);
        });
        it('should calcuate the birth date based on the current age', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'baby',
                        initial_age: '2',
                        language_selection: 'zulu'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(function() {
                var contact = app.api.find_contact('sms', '+1234567');
                assert.equal(contact['extras-mama-sms-user-status'], 'baby');
                var dob = new Date(contact['extras-mama-sms-dob']);
                assert.equal(dob.getFullYear(), 2013);
                assert.equal(dob.getMonth(), 5); // June, baby is in its second month
                assert.equal(contact['extras-mama-sms-hiv-messages'], 'hiv');
                assert.equal(contact['extras-mama-sms-language'], 'zulu');
            }).then(done, done);
        });
        it('should capture the registration date', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'hiv_messages',
                    answers: {
                        user_status: 'baby',
                        initial_age: '2'
                    }
                },
                content: '1',
                next_state: 'end',
                response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
                teardown: assert_single_sms('1234567', 'You signed up to get MAMA SMSs'),
                continue_session: false
            }).then(function() {
                var contact = app.api.find_contact('sms', '+1234567');
                var reg_date = new Date(contact['extras-mama-sms-registration-date']);
                assert.equal(
                    reg_date.toString(),
                    app.api.im.state_creator.get_current_date().toString());
            }).then(done, done);
        });
    });

    describe('when dealing with possibly pregnant women', function() {

        it('should suggest doing a pregnancy test', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'user_status'
                },
                content: '3',
                next_state: 'missed_period',
                response: '^If you have missed a period',
                continue_session: true
            }).then(done, done);
        });
        it('should close off with suggesting to get tested', function(done) {
            var p = tester.check_state({
                user: {
                    current_state: 'missed_period',
                    answers: {
                        'user_status': 'unknown'
                    }
                },
                content: '1',
                next_state: 'get_tested',
                response: '^Don\'t wait! The first pregnancy',
                continue_session: false
            }).then(done, done);
        });
    });

    it('should convert a date of birth month to an birth date guestimate', function(done) {
        var state_creator = app.api.im.state_creator;
        var date = state_creator.month_of_year_to_week(8); // Sept == 8
        assert.equal(date.getFullYear(), 2013);
        assert.equal(date.getMonth(), 8);
        assert.equal(date.getDate(), 15);
        done();
    });

    it('should adjust the date if mother register super early', function(done) {
        var state_creator = app.api.im.state_creator;
        var date = state_creator.month_of_year_to_week(1); // February next year
        assert.equal(date.getFullYear(), 2014);
        assert.equal(date.getMonth(), 1); // February
        done();
    });

    it('should convert a monthly age to a birth date guestimate', function(done) {
        var state_creator = app.api.im.state_creator;
        var date = state_creator.months_to_week(4); // 4 months old baby
        assert.equal(date.getFullYear(), 2013);
        assert.equal(date.getMonth(), 3); // April == 3
        assert.equal(date.getDate(), 17);
        done();
    });

    it('should correctly calculate the number of weeks remaining', function(done) {
        var state_creator = app.api.im.state_creator;
        // 1st of July
        assert.equal(
            state_creator.calculate_weeks_remaining(new Date(2013, 6, 1)),
            -2);
        // 1st of August
        assert.equal(
            state_creator.calculate_weeks_remaining(new Date(2013, 7, 1)),
            2);
        // First monday 40 weeks from now.
        assert.equal(
            state_creator.calculate_weeks_remaining(new Date(2014, 3, 21)),
            40);
        // Exactly today.
        assert.equal(
            state_creator.calculate_weeks_remaining(new Date(2013, 6, 15)),
            0);
        done();
    });

    it('should generate the correct poll number for the birth date', function(done) {
        /**

        NOTE:   according to the vxpolls version if you're due today you should get
                message number 36. I suspect this is because you only find out your
                pregant at week 4 and 4 + 36 == 40;

                This confused me quite a bit. I hope it helps the future us.
        **/
        var state_creator = app.api.im.state_creator;
        // due today so should get poll number 36 (according to the vxpolls version)
        assert.equal(state_creator.get_poll_number(new Date(2013, 6, 15)), 36);
        // due next month so should get poll number 32 (according to the vxpolls version)
        assert.equal(state_creator.get_poll_number(new Date(2013, 7, 15)), 32);
        done();
    });
});

describe("Mama SMS application date utils", function() {

    it('should correctly grab last monday\'s date', function() {
        var state_creator = app.api.im.state_creator;
        state_creator.get_current_date = function() {
            return new Date(2013, 6, 17);
        };
        var monday = state_creator.get_last_monday();
        assert.equal(monday.getFullYear(), 2013);
        assert.equal(monday.getMonth(), 6);
        assert.equal(monday.getDate(), 15);
    });
});

describe('MAMA SMS application without welcome SMS and opt-out reminder', function() {

    var tester;
    var config = {
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'extra_sms_stat_keys': [],
        'sms_tag': ['pool', 'tag'],
        'welcome_sms_copy': ''
    };

    beforeEach(function() {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {

                fixtures.forEach(function(f) {
                    api.load_http_fixture(f);
                });

                api.config_store.config = JSON.stringify(config);

                setup_groups(app, api);
                setup_api(api);
            },
            async: true
        });

        // patch the date functions to return predictable dates
        var state_creator = app.api.im.state_creator;
        state_creator.get_current_date = function() {
            return new Date(2013, 6, 17); // July == 6
        };
        state_creator.get_last_monday = function() {
            return new Date(2013, 6, 15); // July == 6
        };

    });

    it('should not send an SMS if copy is not provided.', function(done) {
        // clear the welcome_sms_copy
        var p = tester.check_state({
            user: {
                current_state: 'hiv_messages',
                answers: {
                    user_status: 'pregnant',
                    expected_month: '2'
                }
            },
            content: '1',
            next_state: 'end',
            response: 'Thanks for joining MAMA. We\'ll start SMSing you this week.',
            teardown: assert_no_sms(),
            continue_session: false
        }).then(done, done);
    });
});

describe('MAMA SMS application opt-status', function () {

    var tester;
    var config = {
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'sms_tag': ['pool', 'tag']
    };

    beforeEach(function () {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {
                api.config_store.config = JSON.stringify(config);

                fixtures.forEach(function(f) {
                    api.load_http_fixture(f);
                });

                setup_api(api);
                api.optout('msisdn', '1234567');
            },
            async: true
        });
    });

    afterEach(function () {
        app.api.optout_store = [];
    });

    it('should ask for opt back in after opt-out', function (done) {
        var p = tester.check_state({
            user: null,
            content: null,
            next_state: 'optstatus',
            response: '^You have previously opted-out',
            continue_session: true
        }).then(done, done);
    });

    it('should allow for someone to remain opted-out', function (done) {
        var p = tester.check_state({
            user: null,
            content: '2',
            next_state: 'remain_opted_out',
            response: '^You remain opted-out of MAMA.',
            continue_session: false
        }).then(done, done);
    });

    it('should allow for someone to opt back in', function (done) {
        var p = tester.check_state({
            user: null,
            content: '1',
            next_state: 'opt_back_in',
            response: '^You have opted-back in to MAMA'
        }).then(done, done);
    });
});

describe('MAMA SMS i18n', function () {

    var locale_data = {
        'setswana': fs.readFileSync('po/setswana/LC_MESSAGES/messages.json'),
        'afrikaans': fs.readFileSync('po/afrikaans/LC_MESSAGES/messages.json')
    };

    var tester;
    var config = {
        'sequential_send_keys': ['foo', 'bar', 'baz'],
        'sms_tag': ['pool', 'tag']
    };

    beforeEach(function() {
        tester = new vumigo.test_utils.ImTester(app.api, {
            custom_setup: function(api) {
                api.config_store.config = JSON.stringify(config);
                api.config_store['translation.setswana'] = locale_data.setswana;
                api.config_store['translation.afrikaans'] = locale_data.afrikaans;
                setup_api(api);
            },
            async: true
        });
    });

    it('should render the menu in the selected language', function (done) {
        var p = tester.check_state({
            user: {
                current_state: 'optstatus'
            },
            content: '4', // Afrikaans
            next_state: 'user_status',
            response: '^Is jy swanger, of het jy \'n baba\\?',
            continue_session: true
        }).then(done, done);
    });
});
