# openapi-routes-generator

This module allows to generate routes from openapi declaration.
Routes contains typings, validation and transformations.

## Types

Types can be generated in this formats:
- request - generate types as it is in request, don't apply any transformations
- handler - generate types as declared in openapi, don't apply any transformations
- server - apply transformations for server (parse request and stringify response)
- client - apply transformations for client (stringify request and parse response)

TODO explain more
