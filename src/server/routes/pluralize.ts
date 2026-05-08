import { Hono } from 'hono';
import { ApiException } from '../../schema/errors.js';
import { HeadwordParam } from '../../schema/api.js';
import { pluralize } from '../../providers/pluralro/index.js';

export const pluralizeRoutes = new Hono();

pluralizeRoutes.get('/pluralize/:noun', (c) => {
  const noun = HeadwordParam.parse(decodeURIComponent(c.req.param('noun')));
  const result = pluralize(noun);
  if (!result) {
    throw new ApiException('WORD_NOT_FOUND', `cannot pluralize "${noun}"`);
  }
  return c.json({
    singular: result.singular,
    plural: result.plural,
    ...(result.gender ? { gender: result.gender } : {}),
  });
});
