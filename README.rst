mama-sms
=======

.. image:: https://travis-ci.org/praekelt/mama-sms.svg?branch=develop
    :target: https://travis-ci.org/praekelt/mama-sms

.. image:: https://coveralls.io/repos/praekelt/mama-sms/badge.png?branch=develop
    :target: https://coveralls.io/r/praekelt/mama-sms

This is the repository for the SMS components of the MAMA project.
This is running in production on *120*2112*2#.

It allows mothers to register for SMS updates on the various stages of their
pregnancy. It works both for pregnant women as for mothers of newborns.

The ``lib`` folders has the Javascript application. Run the javascript tests
with::

    $ npm install .
    $ npm test

How it works:

1. Javascript app captures information and writes contact data, including
   a week-number value that matches their gestational or the baby's age for
   each of the keys in a sequential send application.
2. Vumi Go has 2 smart groups set up, one for general messaging
   and one for HIV messaging.
3. Vumi Go has 4 sequential send conversations set up.

   1. HIV messaging on Mondays
   2. General messaging on Mondays
   3. HIV messaging on Thursdays
   4. General messaging on Thursdays.

As people interact with the service they are automatically assigned to
a smart group and messaging will kick in.

NOTE::

  This code used to be in a private repository called `mama-go` but
  has been extracted from it.
