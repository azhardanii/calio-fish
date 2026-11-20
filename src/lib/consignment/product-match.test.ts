import assert from 'node:assert/strict';
import { resolveProductMatch, type MatchableProduct } from './product-match';
import { matchProductType, type MatchableType } from './product-type-match';

const SAMPLE_TYPES: MatchableType[] = [
  { id: 't-20', code: '20G', name: '20g' },
  { id: 't-60', code: '60G', name: '60g' },
  { id: 't-abon', code: 'ABON', name: 'Abon' },
];

const SAMPLE_PRODUCTS: MatchableProduct[] = [
  {
    id: 'p-sm-60',
    sku: 'FS-SM-60',
    short_name: 'FS SM',
    name: 'Fish Skin Sambal Matah 60g',
    category: '60g',
    product_type_id: 't-60',
    is_active: true,
    product_type: { id: 't-60', code: '60G', name: '60g' },
  },
  {
    id: 'p-soto-60',
    sku: 'FS-SOTO-60',
    short_name: 'FS Soto',
    name: 'Fish Skin Soto 60g',
    category: '60g',
    product_type_id: 't-60',
    is_active: true,
    product_type: { id: 't-60', code: '60G', name: '60g' },
  },
  {
    id: 'p-rendang-20',
    sku: 'FS-RENDANG-20',
    short_name: 'FS RENDANG 20',
    name: 'FISH SKIN RENDANG 20G',
    category: '20g',
    product_type_id: 't-20',
    is_active: true,
    product_type: { id: 't-20', code: '20G', name: '20g' },
  },
  {
    id: 'p-sm-20',
    sku: 'FS-SM-20',
    short_name: 'FS SM 20',
    name: 'FISH SKIN SAMBAL MATAH 20G',
    category: '20g',
    product_type_id: 't-20',
    is_active: true,
    product_type: { id: 't-20', code: '20G', name: '20g' },
  },
  {
    id: 'p-abon-90',
    sku: 'AB-TNA-90',
    short_name: 'Abon 90',
    name: 'Abon Tuna 90g',
    category: 'Abon',
    product_type_id: 't-abon',
    is_active: true,
    product_type: { id: 't-abon', code: 'ABON', name: 'Abon' },
  },
  {
    id: 'p-ori-60',
    sku: 'FS-ORI-60',
    short_name: 'FS Ori 60',
    name: 'Fish Skin Original 60g',
    category: '60g',
    product_type_id: 't-60',
    is_active: true,
    product_type: { id: 't-60', code: '60G', name: '60g' },
  },
  {
    id: 'p-rendang-60',
    sku: 'FS-RENDANG-60',
    short_name: 'FS Rendang 60',
    name: 'Fish Skin Rendang 60g',
    category: '60g',
    product_type_id: 't-60',
    is_active: true,
    product_type: { id: 't-60', code: '60G', name: '60g' },
  },
];

// Exact & compact SKUs
assert.equal(resolveProductMatch('FS-SM-60', SAMPLE_PRODUCTS)?.sku, 'FS-SM-60');
assert.equal(resolveProductMatch('fs_sm_60', SAMPLE_PRODUCTS)?.sku, 'FS-SM-60');
assert.equal(resolveProductMatch('AB-TNA-90', SAMPLE_PRODUCTS)?.sku, 'AB-TNA-90');

// Real WhatsApp group messages from Report CALIOFISH
assert.equal(resolveProductMatch('fs sambal matah 60gr', SAMPLE_PRODUCTS)?.sku, 'FS-SM-60');
assert.equal(resolveProductMatch('Abon 90gr', SAMPLE_PRODUCTS)?.sku, 'AB-TNA-90');
assert.equal(resolveProductMatch('abon', SAMPLE_PRODUCTS)?.sku, 'AB-TNA-90');
assert.equal(resolveProductMatch('fs soto', SAMPLE_PRODUCTS)?.sku, 'FS-SOTO-60');
assert.equal(resolveProductMatch('fs rendang 20gr', SAMPLE_PRODUCTS)?.sku, 'FS-RENDANG-20');
assert.equal(resolveProductMatch('fs ori 60g', SAMPLE_PRODUCTS)?.sku, 'FS-ORI-60');
assert.equal(resolveProductMatch('fs ori', SAMPLE_PRODUCTS)?.sku, 'FS-ORI-60');

// Ambiguous flavor across multiple gramasi without size returns null unless filtered to a category
assert.equal(resolveProductMatch('rendang', SAMPLE_PRODUCTS), null);
const products60g = SAMPLE_PRODUCTS.filter((p) => p.product_type_id === 't-60');
assert.equal(resolveProductMatch('rendang', products60g)?.sku, 'FS-RENDANG-60');

// ProductType matching
assert.equal(matchProductType('60gr', SAMPLE_TYPES)?.code, '60G');
assert.equal(matchProductType('20 g', SAMPLE_TYPES)?.code, '20G');
assert.equal(matchProductType('abon', SAMPLE_TYPES)?.code, 'ABON');

console.log('ALL_PRODUCT_MATCH_TESTS_PASSED');
