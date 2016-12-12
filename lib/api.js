'use strict'
module.exports = function (RED) {
  var HapNodeJS = require('hap-nodejs')
  var UUID = HapNodeJS.uuid

  var _initServiceAPI = function () {
    console.log("api::_initServiceAPI()")

    RED.httpAdmin.get('/homekit/service/types', RED.auth.needsPermission('homekit.read'), function (req, res) {
      var data = {}
      Object.keys(HapNodeJS.Service).forEach(function (key) {
        var val = HapNodeJS.Service[key]
        console.log("_initServiceAPI(): val =", val)
        if (typeof val === 'function' && val.hasOwnProperty('UUID')) {
          console.log("_initServiceAPI(): val.UUID =", val.UUID)
          data[key] = val.UUID
        }
      })
      console.log("api::_initServiceAPI(): ", data)
      res.json(data)
    })
  }

  var init = function () {
    console.log("api::init(): begin")
    _initServiceAPI()
    console.log("api::init(): end")
  }

  return {
    init: init,
    _: {
      initServiceAPI: _initServiceAPI
    }
  }
}
