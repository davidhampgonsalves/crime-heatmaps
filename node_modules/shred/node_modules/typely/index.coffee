{type} = require "fairmont"

$ = module.exports

class Signature 
  
  constructor: -> 
    @signatures = {}
    @failHandler = => false
  
  on: (types...,processor) ->
    @signatures[types.join "."] = processor
    @
  
  fail: (handler) =>
    @failHandler = handler
    @

  match: (args) -> 
    types = (type arg for arg in args)
    signature = types.join "."
    processor = @signatures[signature]
    if processor?
      processor
    else
      console.log signature
      console.log @signatures
      @failHandler
    
$.overload = (declarator) ->
  signature = new Signature
  match = (types...,handler) -> signature.on types..., handler
  fail = (handler) -> signature.fail handler
  declarator(  match, fail )
  (args...) -> (signature.match( args )).call(this, args...)
