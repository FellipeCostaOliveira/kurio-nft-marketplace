/**
 * Fixtures determinísticas. Mesma semente => mesmo catálogo em dev, demo e testes.
 * Os 9 primeiros NFTs reproduzem os cards do Figma (nomes, preços e ordem).
 */
import type {
  CollectionSlug,
  Edition,
  ImageAsset,
  Network,
  NftDetail,
  Review,
  Wallet,
} from '@/api/contracts'
import { COLLECTIONS } from '@/api/contracts'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Character = 'emerald-ape' | 'violet-nomad' | 'ivory-baron' | 'golden-beat'

const CHARACTER_ALT: Record<Character, string> = {
  'emerald-ape': 'macaco marrom com óculos redondos verdes e jaqueta college verde',
  'violet-nomad': 'gorila cinza com chapéu bucket verde-claro e moletom lilás',
  'ivory-baron': 'chimpanzé escuro com gola alta verde e blazer creme',
  'golden-beat': 'macaco dourado com fones de ouvido verdes e jaqueta creme',
}

function image(character: Character, name: string, variant = ''): ImageAsset {
  const suffix = variant ? `-${variant}` : ''
  return {
    src: `/nfts/${character}${suffix}.webp`,
    srcSm: `/nfts/${character}${suffix}-sm.webp`,
    alt: `${name}: ilustração de ${CHARACTER_ALT[character]}`,
  }
}

function gallery(character: Character, name: string): ImageAsset[] {
  return [
    image(character, name),
    { ...image(character, name, 'closeup'), alt: `${name}: detalhe do rosto` },
    { ...image(character, name, 'mirror'), alt: `${name}: vista espelhada` },
    { ...image(character, name, 'warm'), alt: `${name}: variação de cor quente` },
  ]
}

const COLLECTION_COUNTS: Record<CollectionSlug, number> = {
  'arte-digital': 33,
  fotografia: 12,
  musica: 65,
  'arte-3d': 39,
  colecionaveis: 23,
  generativa: 17,
  jogos: 19,
  assinaturas: 13,
  utilidade: 18,
}

const ADJ = ['Emerald', 'Sage', 'Neon', 'Cosmic', 'Violet', 'Ivory', 'Golden', 'Amber', 'Crimson', 'Velvet', 'Lunar', 'Solar', 'Copper', 'Obsidian', 'Jade', 'Rustic', 'Silent', 'Electric', 'Midnight', 'Saffron']
const NOUN = ['Ape', 'Nomad', 'Vessel', 'Bloom', 'Baron', 'Beat', 'Signal', 'Frequency', 'Monarch', 'Drifter', 'Echo', 'Pilot', 'Rhythm', 'Prophet', 'Ranger', 'Oracle', 'Voyager', 'Mystic']
const CHAR_BY_NOUN: Record<string, Character> = {
  Ape: 'emerald-ape', Pilot: 'emerald-ape', Ranger: 'emerald-ape', Monarch: 'emerald-ape',
  Nomad: 'violet-nomad', Bloom: 'violet-nomad', Drifter: 'violet-nomad', Mystic: 'violet-nomad',
  Vessel: 'ivory-baron', Baron: 'ivory-baron', Prophet: 'ivory-baron', Oracle: 'ivory-baron',
  Beat: 'golden-beat', Signal: 'golden-beat', Frequency: 'golden-beat', Rhythm: 'golden-beat', Echo: 'golden-beat', Voyager: 'golden-beat',
}

const CREATORS = ['Nova Sato', 'Lia Moreau', 'Kenji Arata', 'Bia Torres', 'Theo Lindqvist', 'Marisol Duarte']
const ATTRS = ['Óculos', 'Esmeralda', 'Raro', 'Fones', 'Chapéu bucket', 'Moletom', 'Blazer', 'Gola alta', 'Dourado', 'Neon', 'Corrente', 'Holográfico']
const REVIEW_TEXTS = [
  'Arte impecável, os detalhes em alta resolução valem cada ETH.',
  'Processo de compra tranquilo e a procedência está toda registrada.',
  'Uma das peças mais bonitas da minha coleção.',
  'Adorei o acesso desbloqueável para colecionadores.',
  'Ótimo custo-benefício para uma edição limitada.',
  'O criador é muito ativo com a comunidade, recomendo.',
]
const REVIEWERS = ['cripto.lu', 'mvieira', 'arte.na.rede', 'colecionador42', 'dani.eth', 'pixelmonk', 'rafa.nft', 'jucaa']

// Os 9 cards do Figma, em ordem de "Listados recentemente".
const FIGMA: Array<{ name: string; price: string; previousPrice?: string; character: Character; rare?: boolean }> = [
  { name: 'Emerald Ape #042', price: '1.19', character: 'emerald-ape' },
  { name: 'Sage Nomad #009', price: '1.69', character: 'violet-nomad' },
  { name: 'Neon Vessel #552', price: '1.99', previousPrice: '2.29', character: 'ivory-baron', rare: true },
  { name: 'Cosmic Bloom #118', price: '1.29', character: 'violet-nomad' },
  { name: 'Violet Nomad #314', price: '1.39', character: 'violet-nomad' },
  { name: 'Ivory Baron #088', price: '1.79', character: 'ivory-baron' },
  { name: 'Golden Beat #207', price: '0.99', character: 'golden-beat' },
  { name: 'Golden Frequency #071', price: '0.59', character: 'golden-beat' },
  { name: 'Golden Signal #160', price: '0.39', character: 'golden-beat' },
]

export const SEED_NOW = Date.parse('2026-10-20T12:00:00.000Z')

function editionsFor(rand: () => number, opts: { soldOut?: boolean; emerald?: boolean; sold1x1?: boolean; sold1x10?: boolean }): Edition[] {
  if (opts.emerald) {
    return [
      { id: 'e1', label: '1/1', supply: 1, available: 1, maxPerOrder: 1 },
      { id: 'e10', label: '1/10', supply: 10, available: 4, maxPerOrder: 4 },
      { id: 'e50', label: '1/50', supply: 50, available: 37, maxPerOrder: 10 },
      { id: 'open', label: 'Aberta', supply: null, available: 500, maxPerOrder: 20 },
    ]
  }
  const z = opts.soldOut
  return [
    { id: 'e1', label: '1/1', supply: 1, available: z || opts.sold1x1 ? 0 : rand() > 0.4 ? 1 : 0, maxPerOrder: 1 },
    { id: 'e10', label: '1/10', supply: 10, available: z || opts.sold1x10 ? 0 : Math.floor(rand() * 10) + 1, maxPerOrder: 5 },
    { id: 'e50', label: '1/50', supply: 50, available: z ? 0 : Math.floor(rand() * 40) + 10, maxPerOrder: 10 },
    { id: 'open', label: 'Aberta', supply: null, available: z ? 0 : 500, maxPerOrder: 20 },
  ]
}

function toEth(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export function buildCatalog(): NftDetail[] {
  const rand = mulberry32(20261020)
  const slugs: CollectionSlug[] = []
  // Os 9 do Figma entram em "Arte digital"; o restante distribui-se pelas contagens.
  for (const c of COLLECTIONS) for (let i = 0; i < COLLECTION_COUNTS[c.id]; i++) slugs.push(c.id)
  const usedNames = new Set(FIGMA.map((f) => f.name))
  const networks: Network[] = ['ethereum', 'polygon', 'solana']
  const result: NftDetail[] = []

  const arteIdx = slugs.indexOf('arte-digital')
  const order = [...slugs]
  // garante que os 9 primeiros sejam arte-digital
  order.splice(arteIdx, 9)
  const all: CollectionSlug[] = [...Array(9).fill('arte-digital'), ...order]

  all.forEach((collection, i) => {
    const figma = FIGMA[i]
    let name: string
    let character: Character
    let price: string
    let previousPrice: string | null = null
    if (figma) {
      name = figma.name
      character = figma.character
      price = figma.price
      previousPrice = figma.previousPrice ?? null
    } else {
      do {
        const adj = ADJ[Math.floor(rand() * ADJ.length)]
        const noun = NOUN[Math.floor(rand() * NOUN.length)]
        name = `${adj} ${noun} #${String(Math.floor(rand() * 900) + 10).padStart(3, '0')}`
      } while (usedNames.has(name))
      usedNames.add(name)
      character = CHAR_BY_NOUN[name.split(' ')[1]] ?? 'emerald-ape'
      const r = rand()
      price = toEth(Math.min(12.3, 0.02 + Math.pow(r, 2.6) * 12.28))
      if (i === 30) price = '12.30'
      if (i === 31) price = '0.02'
      if (rand() > 0.85) previousPrice = toEth(Number(price) * (1.1 + rand() * 0.3))
    }
    const id = `nft-${String(i + 1).padStart(3, '0')}`
    const tokenNum = name.split('#')[1]
    const network: Network = i < 9 ? 'ethereum' : networks[Math.floor(rand() * 3)]
    const creator = i === 0 ? 'Nova Sato' : CREATORS[Math.floor(rand() * CREATORS.length)]
    const royalty = i === 0 ? 5 : [3, 5, 7, 8][Math.floor(rand() * 4)]
    const soldOut = id === 'nft-013'
    const editions = editionsFor(rand, {
      emerald: i === 0,
      soldOut,
      sold1x1: i === 2,
      sold1x10: i === 3,
    })
    const reviewsCount = i === 0 ? 19 : Math.floor(rand() * 24) + 2
    const reviews: Review[] = Array.from({ length: reviewsCount }, (_, k) => ({
      id: `${id}-r${k + 1}`,
      author: REVIEWERS[(i + k) % REVIEWERS.length],
      rating: k % 7 === 6 ? 4 : 5,
      comment: REVIEW_TEXTS[(i * 3 + k) % REVIEW_TEXTS.length],
      createdAt: new Date(SEED_NOW - (k + 1) * 86400000 * 3).toISOString(),
    }))
    const attributes =
      i === 0 ? ['Óculos', 'Esmeralda', 'Raro'] : [ATTRS[Math.floor(rand() * ATTRS.length)], ATTRS[Math.floor(rand() * ATTRS.length)]].filter((v, k, a) => a.indexOf(v) === k)
    const collectionName = COLLECTIONS.find((c) => c.id === collection)!.name
    const seriesName = { 'emerald-ape': 'Kurio Apes', 'violet-nomad': 'Nomad Club', 'ivory-baron': 'Baron Society', 'golden-beat': 'Golden Frequencies' }[character]
    const totalAvailable = editions.reduce((s, e) => s + e.available, 0)
    const chain = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }[network]
    result.push({
      id,
      name,
      tokenId: `#${tokenNum.padStart(4, '0')}`,
      image: image(character, name),
      price,
      previousPrice,
      collection,
      collectionName,
      network,
      rarity: figma?.rare || (!figma && rand() > 0.88) ? 'rare' : 'common',
      listedAt: new Date(SEED_NOW - i * 3600000 * 7).toISOString(),
      isTrending: i % 4 === 1 || i % 7 === 0,
      totalAvailable,
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${chain}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription: [
        `${name} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${chain}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator} recebe ${royalty}% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      gallery: gallery(character, name),
      editions,
      series: seriesName,
      attributes,
      contract: { address: `0x7A42${(i * 7919).toString(16).padStart(4, '0')}…19${String(68 + (i % 30))}`, standard: network === 'solana' ? 'SPL' : 'ERC-721' },
      royaltyPercent: royalty,
      creator,
      rating: 5,
      reviewsCount,
      reviews,
      related: [],
    })
  })
  return result
}

export interface SeedUser {
  id: string
  username: string
  displayName: string
  email: string
  salt: string
  passwordHash: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
}

/** Senhas dos fixtures: "Kurio@2026" (somente hash + salt são armazenados). */
export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr_ana',
    username: 'ana.colecionadora',
    displayName: 'Ana Ribeiro',
    email: 'ana@kurio.test',
    salt: 'k1-salt-ana',
    passwordHash: 'c08e05babf8dd57ac69028c2029e1123cc0516a39d4912d54e8331195c68998c',
    ensName: 'anaribeiro',
    walletNickname: 'Cofre da Ana',
    avatarUrl: null,
  },
  {
    id: 'usr_bruno',
    username: 'bruno.cunhador',
    displayName: 'Bruno Sato',
    email: 'bruno@kurio.test',
    salt: 'k1-salt-bruno',
    passwordHash: '6f67480d16d69e28d15fc31e1f4659ff3ac59f9fba3e34cf73d571d40b7f149e',
    ensName: 'brunosato',
    walletNickname: 'Carteira principal',
    avatarUrl: null,
  },
]

export const SEED_WALLETS: Record<string, { primary: Wallet | null; secondary: Wallet | null }> = {
  usr_ana: {
    primary: {
      id: 'wal_ana_1',
      slot: 'primary',
      displayName: 'Ana Ribeiro',
      nickname: 'Cofre da Ana',
      network: 'ethereum',
      profileName: 'ana.colecionadora',
      address: '0x8F3a91C27bE4d5A6f0C1e2D3b4A5968778A9E82C',
      secondaryAddress: '',
      walletType: 'metamask',
      referralCode: 'KURIO2026',
      email: 'ana@kurio.test',
      ensName: 'anaribeiro',
      ensSuffix: '.eth',
      updatedAt: new Date(SEED_NOW).toISOString(),
    },
    secondary: {
      id: 'wal_ana_2',
      slot: 'secondary',
      displayName: 'Ana Ribeiro',
      nickname: 'Reserva Coinbase',
      network: 'polygon',
      profileName: 'ana.colecionadora',
      address: '0x1B7c22D3E4f5A6b7C8d9E0F1a2B3c4D5e6F7a8B9',
      secondaryAddress: '',
      walletType: 'coinbase',
      referralCode: 'KURIO2026',
      email: 'ana@kurio.test',
      ensName: 'anaribeiro',
      ensSuffix: '.eth',
      updatedAt: new Date(SEED_NOW).toISOString(),
    },
  },
  usr_bruno: { primary: null, secondary: null },
}

export const SEED_FAVORITES: Record<string, string[]> = {
  usr_ana: ['nft-002', 'nft-006'],
  usr_bruno: ['nft-007'],
}

export const COUPONS: Record<string, { kind: 'percent' | 'fixed'; value: string; expired?: boolean; description: string }> = {
  KURIO10: { kind: 'percent', value: '0.10', description: '10% de desconto no lançamento' },
  GENESIS5: { kind: 'fixed', value: '0.05', description: '0.05 ETH de desconto gênesis' },
  LANCAMENTO: { kind: 'percent', value: '0.15', expired: true, description: 'Cupom de lançamento (expirado)' },
}

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.004',
  solana: '0.002',
}
