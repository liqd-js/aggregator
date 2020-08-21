'use strict';

module.exports = class Aggregator
{
    #callback; #options; #aggregates = new Map(); #pending_aggregates = new Map(); #aggregating = false;

    constructor( callback, options = {})
    {
        this.#callback = callback;
        this.#options = options;
    }

    #delete_pending_aggregate( aggregate )
    {
        let pending_aggregates = this.#pending_aggregates.get( aggregate.id );

        if( pending_aggregates )
        {
            pending_aggregates.delete( aggregate );

            if( !pending_aggregates.size )
            {
                this.#pending_aggregates.delete( aggregate.id );
            }
        }
    }

    #reject( aggregate, err )
    {
        for( let call of aggregate.calls )
        {
            call.reject( err );
        }

        this.#delete_pending_aggregate( aggregate );
    }

    #resolve( aggregate, result )
    {
        if( Array.isArray( result ))
        {
            result = [ ...aggregate.ids ].reduce(( r, id, i ) => ( r[id] = result[i], r ), {});
        }

        for( let call of aggregate.calls )
        {
            let call_result;

            if( Array.isArray( call.id ))
            {
                call_result = [];

                for( let id of call.id )
                {
                    call_result.push( result[ id ]);
                }
            }
            else{ call_result = result[ call.id ]}

            call.resolve( call_result );
        }

        this.#delete_pending_aggregate( aggregate );
    }

    #aggregated_calls()
    {
        this.#aggregating = false;

        for( let aggregate of this.#aggregates.values() )
        {
            this.#aggregates.delete( aggregate.id );

            let pending_aggregates = this.#pending_aggregates.get( aggregate.id );

            if( !pending_aggregates )
            {
                this.#pending_aggregates.set( aggregate.id, pending_aggregates = new Set());
            }

            pending_aggregates.add( aggregate );

            try
            {
                let result = this.#callback([ ...aggregate.ids ], ...aggregate.args );

                if( result instanceof Promise )
                {
                    result.then( result => this.#resolve( aggregate, result )).catch( err => this.#reject( aggregate, err ));
                }
                else{ this.#resolve( aggregate, result )}
            }
            catch( err ){ this.#reject( aggregate, err )}
        }
    }

    call( id, ...args )
    {
        return new Promise(( resolve, reject ) =>
        {
            let aggregateID = JSON.stringify( args ), pending_aggregates, aggregate, pending_results = [];

            if( pending_aggregates = this.#pending_aggregates.get( aggregateID ))
            {
                if( Array.isArray( id ))
                {
                    let ids = new Set( id ), result = {};

                    for( let aggregate of pending_aggregates )
                    {
                        let _ids = [];

                        for( let id of ids )
                        {
                            if( aggregate.ids.has( id ))
                            {
                                ids.delete( id );
                                _ids.push( id );
                            }
                        }

                        if( _ids.length )
                        {
                            pending_results.push( new Promise(( resolve, reject ) => 
                            {
                                aggregate.calls.push({ id: _ids, resolve: ( partial_result ) => 
                                {
                                    _ids.forEach(( id, i ) => result[id] = partial_result[i] );

                                    resolve();
                                },
                                reject });
                            })
                            .catch( reject ));
                        }
                    }

                    if( pending_results.length )
                    {
                        let original_resolve = resolve, original_ids = id;
                        
                        id = [...ids];

                        resolve = async( partial_result ) =>
                        {
                            id.forEach(( id, i ) => result[id] = partial_result[i] );

                            await Promise.all( pending_results );

                            original_resolve( original_ids.map( id => result[id] ));
                        }
                        
                        if( !ids.size ){ return resolve([])}   
                    }
                }
                else
                {
                    for( let aggregate of pending_aggregates )
                    {
                        if( aggregate.ids.has( id ))
                        {
                            return aggregate.calls.push({ id, resolve, reject });
                        }
                    }
                }
            }

            if( !( aggregate = this.#aggregates.get( aggregateID )))
            {
                this.#aggregates.set( aggregateID, aggregate = { id: aggregateID, ids: new Set(), args, calls: []});
            }

            if( Array.isArray( id ))
            {
                id.forEach( id => aggregate.ids.add( id ));
            }
            else{ aggregate.ids.add( id )}

            aggregate.calls.push({ id, resolve, reject });

            if( !this.#aggregating )
            {
                this.#aggregating = true;

                process.nextTick( this.#aggregated_calls.bind( this ));
            }
        })
    }
}