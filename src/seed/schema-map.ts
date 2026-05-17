export const ALLOWED_TABLES = new Set([
  'Entry',
  'Lexem',
  'Lexeme',
  'Definition',
  'Meaning',
  'InflectedForm',
  'Source',
  'Tree',
  'TreeEntry',
  'EntryDefinition',
]);

export interface DexEntryRow {
  id: number;
  description?: string;
  partOfSpeech?: string | null;
  number?: number | null;
}

export interface DexLexemeRow {
  id: number;
  formNoAccent?: string;
  formUtf8General?: string;
  description?: string | null;
  modelType?: string | null;
  modelNumber?: string | null;
}

export interface DexDefinitionRow {
  id: number;
  sourceId?: number;
  internalRep?: string;
  htmlRep?: string;
  status?: number | null;
  lexicon?: string | null;
}

export interface DexInflectedFormRow {
  id: number;
  lexemeId: number;
  inflectionId: number;
  form: string;
  formNoAccent?: string;
}

export interface DexSourceRow {
  id: number;
  shortName?: string;
  name?: string;
  publisher?: string | null;
  year?: string | null;
}

export const TABLE_COLUMNS: Record<string, string[]> = {
  Entry: ['id', 'description', 'partOfSpeech', 'number'],
  Lexem: ['id', 'formNoAccent', 'formUtf8General', 'description', 'modelType', 'modelNumber'],
  Lexeme: ['id', 'formNoAccent', 'formUtf8General', 'description', 'modelType', 'modelNumber'],
  Definition: ['id', 'sourceId', 'internalRep', 'htmlRep', 'status', 'lexicon'],
  Meaning: ['id', 'parentId', 'displayOrder', 'breadcrumb', 'internalRep'],
  InflectedForm: ['id', 'lexemeId', 'inflectionId', 'form', 'formNoAccent'],
  Source: ['id', 'shortName', 'name', 'publisher', 'year'],
  Tree: ['id', 'description'],
  TreeEntry: ['treeId', 'entryId'],
  EntryDefinition: ['entryId', 'definitionId'],
};
