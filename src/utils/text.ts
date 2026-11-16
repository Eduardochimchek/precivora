/** Chave de busca: minúsculas, sem acentos e espaços colapsados. */
export function searchKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matches(haystack: string, query: string): boolean {
  const q = searchKey(query);
  if (!q) return true;
  const h = searchKey(haystack);
  return q.split(' ').every((part) => h.includes(part));
}

/** Remove caracteres de controle e limita o tamanho de textos livres. */
export function cleanText(s: string | undefined | null, max = 500): string | undefined {
  if (s == null) return undefined;
  const v = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  return v || undefined;
}

export const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}
