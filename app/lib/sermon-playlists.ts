export const SERMON_PLAYLISTS = {
  PCF_PREACHING: {
    id: "PLhbpMEAjdMLLOg9EcJ8IZkYq9jVKaxrtx",
    label: "PCF Preaching",
    description: "Main preaching series from Powerhouse Church",
  },
  SERMON_HIGHLIGHTS: {
    id: "PLhbpMEAjdMLJMzp8dF9YAa_j3VhN0zi9z",
    label: "Sermon Highlights",
    description: "Highlight clips and key messages",
  },
  MIDWEEK_SERVICE: {
    id: "PLhbpMEAjdMLKgumOnCV0l_OD3UVESY1gk",
    label: "Powerhouse Midweek Service",
    description: "Mid-week services and teachings",
  },
  CELL_CELEBRATION: {
    id: "PLhbpMEAjdMLLcMoI1qLUg2TeTADb2PrD3",
    label: "Powerhouse Cell Celebration",
    description: "Cell group meetings and celebrations",
  },
} as const;

export type SermonPlaylistKey = keyof typeof SERMON_PLAYLISTS;
