import { parseCategory, type Category } from '../schema';
import worldCapitals from './world-capitals.json';
import rownania from './rownania-matematyczne.json';
import seriale from './seriale.json';
import filmy from './filmy.json';
import influencerzy from './influencerzy.json';
import urodziny from './urodziny.json';
import samochody from './samochody.json';
import warzywa from './warzywa.json';
import owoce from './owoce.json';
import alkohole from './alkohole-i-drinki.json';
import czesci from './czesci-samochodowe.json';
import ciuchy from './marki-ciuchow-loga.json';
import fastFoody from './fast-foody-loga.json';
import zwierzeta from './zwierzeta.json';
import zawody from './zawody.json';
import polska from './polska.json';
import ceny from './zgadywanie-cen-produktow.json';

const raw: unknown[] = [worldCapitals, rownania, seriale, filmy, influencerzy, urodziny, samochody, warzywa, owoce, alkohole, czesci, ciuchy, fastFoody, zwierzeta, zawody, polska, ceny];

export const BUNDLED_CATEGORIES: Category[] = raw
  .map((entry) => parseCategory(entry, 'bundled'))
  .filter((c): c is Category => c !== null);
