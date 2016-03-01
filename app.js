// routes
app.route('/api/v1/stripe/charge')
  .post(campaigns.charge)
app.route('/api/v1/stripe/customer/:customerId')
  .get(campaigns.retrieveCustomer)
  .post(campaigns.createCustomer)
  .put(campaigns.updateCustomer)
  .delete(campaigns.deleteCustomer)
app.route('/api/v1/stripe/card/:customerId')
  .get(campaigns.getAllCards)
  .post(campaigns.addCardCustomer)
  .put(campaigns.updateCard)
  .delete(campaigns.deleteCard)
app.route('/api/v1/stripe/token')
  .post(campaigns.createToken)
app.route('/api/v1/stripe/token/:tokenId')
  .post(campaigns.getToken)

// stripe  controller
'use strict'

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  fs = require('fs'),
  path = require('path'),
  errorHandler = require('../utilities/errors.server.controller'),
  responseHandler = require('../utilities/response.server.controller'),
  queryHandler = require('../utilities/query.server.controller'),
  Campaign = mongoose.model('Campaign'),
  Picture = mongoose.model('Picture'),
  _ = require('lodash'),
  email = require('./campaign.email.controller'),
  stripe = require('stripe')('id')
// down the road implement being able to upload pictures
module.exports = {
  chargeCampaign: chargeCampaign,
  charge: charge,
  createCustomer: createCustomer,
  retrieveCustomer: retrieveCustomer,
  updateCustomer: updateCustomer,
  deleteCustomer: deleteCustomer,
  addCardCustomer: addCardCustomer,
  getAllCards: getAllCards,
  updateCard: updateCard,
  deleteCard: deleteCard,
  createToken: createToken,
  getToken: getToken
}

function charge (req, res) {
  stripe.charges.create({
    amount: req.body.total,
    currency: 'usd',
    source: req.body.stripeToken, // obtained with Stripe.js
    description: req.body.description || 'Love Animals, Donate'
  }, function (err, charge) {
    if (err) res.status(400).send(err).end()
    else res.status(200).send(charge).end()
  })
}

function chargeCampaign (req, res) {
  var campaign = req.campaign
  // See https://stripe.com/docs/api/node#customer_object

  var stripeToken = req.body.stripeToken
  var charge = stripe.charges.create({
    amount: req.query.total, // amount in cents, again
    currency: 'usd',
    source: stripeToken,
    description: 'Love Animals, Donations:' + campaign.name
  }, function (err, charge) {
    if (err && err.type === 'StripeCardError') {
      res.status(400).send(err)
    } else {
      try {
        if (charge.paid == true) {
          campaign.raised = (charge.amount / 100) + campaign.raised
          campaign.donations.push({
            'description': charge.description,
            'paid': charge.paid,
            'status': charge.status,
            'amount': (charge.amount / 100),
            'fingerprint': charge.source.fingerprint,
            'sourceid': charge.source.id
          })
          email.sendMail({
            to: campaign.email,
            subject: 'A Donation has been made',
            html: 'donation:$' + (charge.amount / 100)
          })
          campaign.save(function (err) {
            if (err) {
              return res.status(500).json({
                error: 'Cannot update the campaign donation'
              })
            }
            res.redirect('/campaigns/' + campaign._id)
          })
        }
      } catch (err) {
        console.log(err)
        res.redirect('/campaigns/' + campaign._id + '/donate')
      }
    }
  })

}

function createCustomer (req, res) {
  stripe.customers.create({
    description: 'Customer for test2@example.com'
  // source: "tok_16hVvgLcKry90nDaspcBzFMg" // obtained with Stripe.js
  }, function (err, customer) {
    if (err) res.status(400).send(err).end()
    else res.status(200).send(customer).end()
  })
}

function retrieveCustomer (req, res) {
  stripe.customers.retrieve(
    req.params.customerId,
    function (err, customer) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(customer).end()
    }
  )
}

function updateCustomer (req, res) {
  stripe.customers.update(req.params.customerId, {
    description: 'Customer for test@example.com'
  }, function (err, customer) {
    if (err) res.status(400).send(err).end()
    else res.status(200).send(customer).end()
  })
}

function deleteCustomer (req, res) {
  stripe.customers.del(
    req.params.customerId,
    function (err, confirmation) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(confirmation).end()
    }
  )
}
// card
function addCardCustomer (req, res) {
  stripe.customers.createSource(
    req.params.customerId, {
      source: req.body.stripeToken
    },
    function (err, card) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(card).end()
    }
  )
}

function getAllCards () {
  stripe.customers.listCards(req.params.customerId, function (err, cards) {
    if (err) res.status(400).send(err).end()
    else res.status(200).send(card).end()
  })
}

function updateCard () {
  stripe.customers.updateCard(
    req.params.customerId,
    req.body.card, {
      name: req.body.name
    },
    function (err, card) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(card).end()
    }
  )
}

function deleteCard () {
  stripe.customers.deleteCard(
    req.params.customerId,
    req.body.card,
    function (err, confirmation) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(confirmation).end()
    }
  )
}
// token
function createToken (req, res) {
  stripe.tokens.create({
    card: {
      'number': req.body.number,
      'exp_month': req.body.exp_month,
      'exp_year': req.body.exp_year,
      'cvc': req.body.cvc
    }
  }, function (err, token) {
    if (err) res.status(400).send(err).end()
    else res.status(200).send(token).end()
  })
}

function getToken () {
  stripe.tokens.retrieve(
    req.body.stripeToken,
    function (err, token) {
      if (err) res.status(400).send(err).end()
      else res.status(200).send(token).end()
    }
  )
}
