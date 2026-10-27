# [3.0.0](https://github.com/hendrik-ro/theatre-server/compare/v2.0.4...v3.0.0) (2026-10-27)


### Bug Fixes

* **movies:** added search filter condition on db query ([8b11e44](https://github.com/hendrik-ro/theatre-server/commit/8b11e449a75d9bcb93d433f66bba22f64965ffed))


### Features

* dropped imdb, rating starts at 1, controller defines sort ([c116d61](https://github.com/hendrik-ro/theatre-server/commit/c116d6104eb595572a91dd35ac2565eb0e45f6c5))
* **movies:** server-side search & sorting ([70840e4](https://github.com/hendrik-ro/theatre-server/commit/70840e40ee892d5d9547b144330cc38605bbc489))


### BREAKING CHANGES

* altered schemas

## [2.0.4](https://github.com/hendrik-ro/theatre-server/compare/v2.0.3...v2.0.4) (2026-10-26)

### Bug Fixes

- **models:** calculate movie max year dynamically ([a04fe5e](https://github.com/hendrik-ro/theatre-server/commit/a04fe5e34c8f110c8f167903f27bce0eb8fe2231))
- **movies:** preprocess filters 'null' -> null ([2a14893](https://github.com/hendrik-ro/theatre-server/commit/2a1489354c966f290642afd9aa8b36aa771fdac8))
- rm race condition authenticateJWT, watchlistsAddMovie 400 -> 404, usersRefresh check cookies ([dfff25f](https://github.com/hendrik-ro/theatre-server/commit/dfff25f38491485181c63ebd64d837eeb7072a09))

## [2.0.3](https://github.com/hendrik-ro/theatre-server/compare/v2.0.2...v2.0.3) (2026-10-25)

### Bug Fixes

- **movies:** filtering ratings gte ([a404a63](https://github.com/hendrik-ro/theatre-server/commit/a404a632ecbf852b00f829e67ddd847e7ecb4623))

## [2.0.2](https://github.com/hendrik-ro/theatre-server/compare/v2.0.1...v2.0.2) (2026-10-25)

### Bug Fixes

- **movies:** filter interface null | unknown ([498679e](https://github.com/hendrik-ro/theatre-server/commit/498679ea97cb32d939f3dc839d8e9eafdae806a8))

## [2.0.1](https://github.com/hendrik-ro/theatre-server/compare/v2.0.0...v2.0.1) (2026-10-25)

### Bug Fixes

- **pagination:** added filters to db query ([95ee8c0](https://github.com/hendrik-ro/theatre-server/commit/95ee8c006d6393fe5138a7a38a4f2b32792b1689))

# [2.0.0](https://github.com/hendrik-ro/theatre-server/compare/v1.6.2...v2.0.0) (2026-10-24)

### Features

- **logs:** extended logging ([e371a60](https://github.com/hendrik-ro/theatre-server/commit/e371a603110717a6de51dd146585f0b06412dd59))
- **movies:** paginated movie results ([a8dc6cd](https://github.com/hendrik-ro/theatre-server/commit/a8dc6cd88f8c60decf7ec43a99f619310bfd1acf))

### BREAKING CHANGES

- **movies:** GET /api/movies now returns a paginated envelope, breaks API contract for client

## [1.6.2](https://github.com/hendrik-ro/theatre-server/compare/v1.6.1...v1.6.2) (2026-10-24)

### Bug Fixes

- **logs:** added logger, logs volume ([3c0ba0d](https://github.com/hendrik-ro/theatre-server/commit/3c0ba0df61d9b531151f0f7ff8aa051bc01df23a))

## [1.6.1](https://github.com/hendrik-ro/theatre-server/compare/v1.6.0...v1.6.1) (2026-10-24)

### Bug Fixes

- content security policy + cors ([#11](https://github.com/hendrik-ro/theatre-server/issues/11)) ([54a983d](https://github.com/hendrik-ro/theatre-server/commit/54a983d46801e538291bf11d0dd35dd90c85b053))

# [1.6.0](https://github.com/hendrik-ro/theatre-server/compare/v1.5.0...v1.6.0) (2026-10-22)

### Features

- **ratings:** added average ratings to GET /api/movies/ ([0ddbaa1](https://github.com/hendrik-ro/theatre-server/commit/0ddbaa1608923583c3f64d63dab7503cccb9d913))

# [1.5.0](https://github.com/hendrik-ro/theatre-server/compare/v1.4.0...v1.5.0) (2026-10-22)

### Bug Fixes

- endpoint fetch all user movie ratings ([402a132](https://github.com/hendrik-ro/theatre-server/commit/402a13220ebce5835db284004aef18d0c8fc835e))

### Features

- **ratings:** add GET /api/ratings endpoint ([7c175ef](https://github.com/hendrik-ro/theatre-server/commit/7c175ef18964d55053c48125526481cf900c7352))

# [1.4.0](https://github.com/hendrik-ro/theatre-server/compare/v1.3.0...v1.4.0) (2026-10-21)

### Bug Fixes

- harden movie ratings and test reset ([d57b5d3](https://github.com/hendrik-ro/theatre-server/commit/d57b5d337dfe492fc25bb7c97a41b6e61b6ed9ff))

### Features

- movie ratings ([1c14413](https://github.com/hendrik-ro/theatre-server/commit/1c144135fa2a1b55a3f66b3153dbe49af68f196f))
- movie ratings ([#6](https://github.com/hendrik-ro/theatre-server/issues/6)) ([8e612cc](https://github.com/hendrik-ro/theatre-server/commit/8e612cc2d3f7732f4178b43f10dfd10b086bafc1))

# [1.3.0](https://github.com/hendrik-ro/theatre-server/compare/v1.2.1...v1.3.0) (2026-10-20)

### Features

- watchlists ([#5](https://github.com/hendrik-ro/theatre-server/issues/5)) ([1260af1](https://github.com/hendrik-ro/theatre-server/commit/1260af1604e497bd7a75a3fe35f7de802ea34cb6))

## [1.2.1](https://github.com/hendrik-ro/theatre-server/compare/v1.2.0...v1.2.1) (2026-10-19)

### Bug Fixes

- docker compose migration service ([#4](https://github.com/hendrik-ro/theatre-server/issues/4)) ([4023f38](https://github.com/hendrik-ro/theatre-server/commit/4023f389befc146351d430dbc2bdbfc2e67ac345))

# [1.2.0](https://github.com/hendrik-ro/theatre/compare/v1.1.1...v1.2.0) (2026-10-17)

### Features

- jwt authentication ([#19](https://github.com/hendrik-ro/theatre/issues/19)) ([9810c41](https://github.com/hendrik-ro/theatre/commit/9810c411e1f91d7734bc7258b92cf122f67094bb))

## [1.1.1](https://github.com/hendrik-ro/theatre/compare/v1.1.0...v1.1.1) (2026-10-16)

### Bug Fixes

- bootstrap admin ([#18](https://github.com/hendrik-ro/theatre/issues/18)) ([02b2f98](https://github.com/hendrik-ro/theatre/commit/02b2f98f373aa87c5d6f6e8c5cc046894f4c61fd))

# [1.1.0](https://github.com/hendrik-ro/theatre/compare/v1.0.0...v1.1.0) (2026-10-15)

### Features

- users ([#16](https://github.com/hendrik-ro/theatre/issues/16)) ([d6aea50](https://github.com/hendrik-ro/theatre/commit/d6aea50ca9a45efaaf5abcfe6d0a2a6860f42ce1))

# 1.0.0 (2026-10-14)

- API movies router ([#2](https://github.com/hendrik-ro/theatre/issues/2)) ([e20626c](https://github.com/hendrik-ro/theatre/commit/e20626cf0b0fb1134f474ff149d9719e8fc59bc1))

### Bug Fixes

- **release:** authenticate checkout with app token ([#14](https://github.com/hendrik-ro/theatre/issues/14)) ([6b02899](https://github.com/hendrik-ro/theatre/commit/6b028996b610bc35f0a02ab4a46c100c374adfe5))
- **release:** use create-github-app-token action ([#13](https://github.com/hendrik-ro/theatre/issues/13)) ([e3cc9b2](https://github.com/hendrik-ro/theatre/commit/e3cc9b2c8d9693fd535eb849508781f26b3da5e3))

### Features

- **movies:** first protoype ([#11](https://github.com/hendrik-ro/theatre/issues/11)) ([3413595](https://github.com/hendrik-ro/theatre/commit/3413595f5a1681be998d2297bed49b4a0bad1d9a))
