import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Move: a
    .model({
      id: a.id(),
      gameId: a.string().required(),
      from: a.string().required(),
      to: a.string().required(),
      san: a.string().required(),
      fenAfter: a.string().required(),
      createdAt: a.datetime().required(),
    })
    .identifier(["id"])
    .authorization((allow) => [
      allow.guest(),
      allow.authenticated("identityPool"),
    ]),

  Game: a
    .model({
      id: a.id(),
      fen: a.string().required(),
      turn: a.string().required(),       // "w" or "b"
      status: a.string().required(),     // "WAITING", "IN_PROGRESS", etc.
      whitePlayerId: a.string(),
      blackPlayerId: a.string(),
      whitePlayerName: a.string(),
      blackPlayerName: a.string(),
      createdAt: a.datetime().required(),
      expiresAt: a.integer(),

      drawOfferBy: a.string(),
    })
    .identifier(["id"])
    .authorization((allow) => [
      allow.guest(),
      allow.authenticated("identityPool"),
    ]),

  PlayerElo: a
    .model({
      id: a.id(),
      elo: a.integer().default(1200),
    })
    .identifier(["id"]) // match Game/Move style
    .authorization((allow) => [
      allow.guest(),                    // unauth guest
      allow.authenticated("identityPool"), // logged-in / identityPool users
    ]),
});



export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
