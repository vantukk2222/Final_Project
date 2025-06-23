export interface PaginationState {
  lastDoc: any | null;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
}

export interface QueryConfig {
  collection: string;
  field: string;
  operator: any;
  value: any;
  orderBy: string;
  orderDirection: 'asc' | 'desc';
  limit: number;
}
