# OpenAPI validation schema provenance

`openapi-3.1-schema.json` is the unmodified OpenAPI Initiative document schema
with `$id` https://spec.openapis.org/oas/3.1/schema/2021-04-15 and JSON Schema
2020-12 dialect, retrieved from `@apidevtools/openapi-schemas@2.1.0`,
`package/schemas/v3.1/schema.json`, via its npm registry tarball.

The official spec host was unreachable during C5; the package is only an acquisition
source, not a new installed dependency. Its supplied license is retained in
`openapi-schema-LICENSE.txt`. Tests additionally compile every generated payload
schema with the existing Fastify Ajv2020 dependency. No network is needed in CI.
