'use strict';

const Aggregator = require('../lib/aggregator');

let aggregator = new Aggregator(( ids, ...args ) => 
{
    console.log( 'Call', ids, args );

    let result;

    if( Math.random() < 0.5 )
    {
        result = [];

        for( let id of ids )
        {
            result.push({ id, args });
        }
    }
    else
    {
        result = {};

        for( let id of ids )
        {
            result[id] = { id, args };
        }
    }

    //return Math.random() < 0.5 ? new Promise( resolve => resolve( result )) : result;

    return new Promise( resolve => setTimeout(() => resolve( result ), 1000 ));
});

aggregator.call( 10, 'foo', 'bar' ).then( console.log );
aggregator.call( 20, 'foo', 'bar' ).then( console.log );
aggregator.call( 20, 'foo', 'barn' ).then( console.log );
aggregator.call( 30, 'foo', 'bar' ).then( console.log );
aggregator.call( 10, 'foo', 'bar' ).then( console.log );
aggregator.call( 20, 'foo', { a: 'bar', b: false }).then( console.log );
aggregator.call([ 10, 20 ], 'foo', 'bar' ).then( console.log );

setTimeout(() =>
{
    aggregator.call( 10, 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call( 10, 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call( 50, 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call( 50, 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call([ 10, 20 ], 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call([ 10, 50 ], 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
    aggregator.call([ 60, 10, 20, 50, 70 ], 'foo', 'bar' ).then( console.log.bind( null, 'later' ));
},
500 );