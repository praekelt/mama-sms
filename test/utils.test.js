var assert = require('assert'),
    moment = require('moment');

describe("go.utils", function() {

    beforeEach(function() {
        // patch the date we're working with in tests.
        go.utils.get_current_date = function() {
            return moment.utc('2014-09-01T00:00:00+00:00').toDate();
        };
    });

    it('should calculate the week of year when given a month', function() {
        // December, still in 2014
        assert.equal(
            go.utils.month_of_year_to_week('11').toISOString(),
            '2014-12-14T22:00:00.000Z');
        // January, should roll over into 2015
        assert.equal(
            go.utils.month_of_year_to_week('0').toISOString(),
            '2015-01-14T22:00:00.000Z');
    });

    it('should calculate the week when given a month', function () {
        // this turns the 'how many months old is your baby' question
        // into how many weeks old the baby already is.
        // NOTE: the calculation is pretty rough as we're assuming 4 weeks
        //       in a month
        assert.equal(
            go.utils.months_to_week(1).toISOString(),
            '2014-08-25T00:00:00.000Z');
        assert.equal(
            go.utils.months_to_week(12).toISOString(),
            '2013-10-21T00:00:00.000Z');
    });

    it('should return today\'s date as a string', function () {
        assert.equal(
            go.utils.get_today_as_string(),
            '2014-09-01');
    });
    it('should return a holodeck compatible timestamp', function () {
        assert.equal(
            go.utils.get_holodeck_timestamp(),
            '2014-09-01 00:00:00');
    });
    it('should calculate when last monday was');
    it('should return the week number when given a birth date');
    it('should provide a helper function for getting the seq-send keys');
    it('should provide a helper for sending an SMS');
});
