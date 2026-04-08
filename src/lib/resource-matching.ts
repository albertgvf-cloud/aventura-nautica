// Maps an activity variant name to the resources it needs
// This is the business logic linking "Jet Ski – individual" → jet_ski resources, etc.

export type ResourceFilter = {
  type: string
  model?: string
  requires_license?: boolean
}

export function getResourceFilter(variantName: string): ResourceFilter | null {
  const n = variantName.toLowerCase()

  if (n.includes('monster')) return { type: 'nautic_boat', model: 'Monster' }
  if (n.includes('crazy') || n.includes('banana')) return { type: 'nautic_boat', model: 'Tow' }
  if (n.includes('parasail')) return { type: 'parasail_boat' }

  if (n.includes('boat rental')) {
    return { type: 'boat', requires_license: n.includes('with license') && !n.includes('without') }
  }

  if (n.includes('jet ski')) return { type: 'jet_ski' }

  if (n.includes('bliss 45')) return { type: 'catamaran', model: 'Bliss 45' }
  if (n.includes('bliss 70')) return { type: 'catamaran', model: 'Bliss 70' }

  return null
}
