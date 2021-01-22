const chai = require('chai');
const expect = chai.expect;

const dm = require('../lib/deckManager');

describe('Deck Manager', function(){
    it ('Should throw an error for a bad deck', function(){
        var bad = function(){ return new dm(null,[],{}) };
        expect(bad).to.throw('elgato');        
    });
    it ('Should throw an error for a bad buttons array', function(){
        var bad = function(){ return new dm({}, null,{}) };
        expect(bad).to.throw('array');        
    });
    it ('Should throw an error for a bad deck', function(){
        var bad = function(){ return new dm({},[null],null) };
        expect(bad).to.throw('Config');        
    });
});