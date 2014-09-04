var assert = require('assert'),
  moment = require('moment');

describe("go.utils", function() {

  beforeEach(function() {
    // patch the date we're working with in tests.
    go.utils.get_current_date = function() {
      return moment.utc('2014-09-01T00:00:00+00:00').toDate();
    };
  });

  it('should calculate the week of year when given a month in this year', function() {
    // December, still in 2014
    assert.equal(
      go.utils.month_of_year_to_week('11').toISOString(),
      '2014-12-15T00:00:00.000Z');
  });

  it('should calculate the week of year when given a month in next year', function() {
    // January, should roll over into 2015
    assert.equal(
      go.utils.month_of_year_to_week('0').toISOString(),
      '2015-01-15T00:00:00.000Z');
  });

  it('should calculate the week of year when given a month in past year', function() {
    // May should roll over into 2015
    assert.equal(
      go.utils.month_of_year_to_week('4').getFullYear(), 2015);
    // June should still be 2014
    assert.equal(
      go.utils.month_of_year_to_week('5').getFullYear(), 2014);

  });

  it('should calculate the week when given a month', function () {
    // this turns the 'how many months old is your baby' question
    // into how many weeks old the baby already is.
    // NOTE: the calculation is pretty rough as we're assuming 4 weeks
    //     in a month
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
  it('should calculate when last monday was on monday', function () {
    assert.equal(
      go.utils.get_last_monday().toISOString(),
      '2014-08-25T00:00:00.000Z');
  });
  it('should calculate when last monday was on a not monday', function () {
    assert.equal(
      go.utils.get_last_monday(
        moment.utc('2014-09-02T00:00:00+00:00').toDate()).toISOString(),
      '2014-09-01T00:00:00.000Z');
  });
  it('should return the week number when given birth date is today', function () {
    assert.equal(
      go.utils.calculate_weeks_remaining(
        moment.utc('2014-09-01T00:00:00.000Z').toDate()),
      1);
  });
  it('should return the week number when given birth date 9 months away', function () {
    assert.equal(
      go.utils.calculate_weeks_remaining(
        moment.utc('2015-06-01T00:00:00.000Z').toDate()),
      40);
  });
  it('should return the week number when given birth date 3 months away', function () {
    assert.equal(
      go.utils.calculate_weeks_remaining(
        moment.utc('2014-12-01T00:00:00.000Z').toDate()),
      14);
  });
  it('should return the week number when given birth date 6 months away', function () {
    assert.equal(
      go.utils.calculate_weeks_remaining(
        moment.utc('2015-03-01T00:00:00.000Z').toDate()),
      26);
  });
  it('should return the week number when given a past birth date', function () {
    assert.equal(
      go.utils.calculate_weeks_remaining(
        moment.utc('2014-08-18T00:00:00.000Z').toDate()),
      -1);
  });
  it('should return a "poll number" for a birth date', function () {
    assert.equal(
      go.utils.get_poll_number(
        moment.utc('2014-11-15T00:00:00.000Z').toDate()),
      25);
  });
});
