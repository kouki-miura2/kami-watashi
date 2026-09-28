import { responseLabel, type ResponseStatus } from './print-filter.ts'
import { formatPrintLabel, formatDateString } from './print-format.ts'

/** A `GET /histories` item (the fields the wording needs). */
export interface HistoryItem {
  memberName: string
  target: 'child' | 'topic' | 'print' | 'member'
  action: 'create' | 'update' | 'delete' | 'bulk_delete'
  name: string | null
  newName: string | null
  printSeq: number | null
  details: Record<string, unknown> | null
}

export interface HistoryLine {
  /** Who did it (bold in the timeline). */
  who: string
  /** What they did, after `が`. */
  text: string
  /** The print items, shown on a second line (spec "プリントの項目の表示形式"); empty for none. */
  detail: string
  /** The timeline dot: registered / changed / deleted. */
  kind: 'create' | 'update' | 'delete'
}

const topicTag = (name: string | null) => `[ ${name ?? ''} ]`
// The spec spaces a topic tag off from the text before it, `が` included: 「一郎が [ サッカー ] …」.
const topicText = (text: string) => ` ${text}`

/** `1年` / `6か月` / `3か月`, as the spec words the bulk-deletion periods. */
const periodLabel = (months: number) => (months % 12 === 0 ? `${months / 12}年` : `${months}か月`)

/** A print's items in the spec's order and format, each only when recorded. */
const printDetail = (details: Record<string, unknown> | null): string => {
  if (!details) return ''
  const parts: string[] = []
  if ('title' in details) parts.push(`「${(details.title as string | null) ?? ''}」`)
  if ('topics' in details) parts.push(`[ ${(details.topics as string[]).join(', ')} ]`)
  if ('received_on' in details) {
    const date = details.received_on as string | null
    parts.push(date ? `${formatDateString(date)}受取` : '受取日なし')
  }
  if ('due_on' in details) {
    const date = details.due_on as string | null
    parts.push(date ? `${formatDateString(date)}まで` : '期限なし')
  }
  if ('response_status' in details) {
    parts.push(`対応=${responseLabel(details.response_status as ResponseStatus)}`)
  }
  if ('image_count' in details) parts.push(`写真=${details.image_count as number}枚`)
  return parts.join('、')
}

const kindOf = (action: HistoryItem['action']): HistoryLine['kind'] =>
  action === 'create' ? 'create' : action === 'update' ? 'update' : 'delete'

const VERBS = { create: '登録', update: '変更', delete: '削除', bulk_delete: '一括削除' } as const

/** One history entry in the spec's wording ("履歴 > 表示例"), split for the timeline (6a). */
export const formatHistory = (item: HistoryItem): HistoryLine => {
  const line = (text: string, detail = ''): HistoryLine => ({
    who: item.memberName,
    text,
    detail,
    kind: kindOf(item.action),
  })
  const printCount = Number(item.details?.print_count ?? 0)

  switch (item.target) {
    case 'child':
      if (item.action === 'update') return line(`${item.name}を${item.newName}に変更`)
      if (item.action === 'delete') {
        return line(
          `${item.name}を削除${printCount > 0 ? `（プリント${printCount}件も削除）` : ''}`,
        )
      }
      return line(`${item.name}を登録`)
    case 'topic':
      if (item.action === 'update') {
        return line(
          topicText(`${topicTag(item.name)} トピックを ${topicTag(item.newName)} トピックに変更`),
        )
      }
      if (item.action === 'delete') {
        return line(topicText(`${topicTag(item.name)} トピックを削除（すべてのプリントから削除）`))
      }
      return line(topicText(`${topicTag(item.name)} トピックを登録`))
    case 'member':
      return line(`表示名を${item.newName}に変更`)
    case 'print': {
      if (item.action === 'bulk_delete') {
        const months = Number(item.details?.older_than_months)
        return line(`${periodLabel(months)}以上前に登録したプリントを一括削除（${printCount}件）`)
      }
      const label =
        item.printSeq === null
          ? `${item.name}のプリント`
          : formatPrintLabel(item.name ?? '', item.printSeq)
      return line(`${label}を${VERBS[item.action]}`, printDetail(item.details))
    }
  }
}

/** The whole entry as one sentence, as the spec writes it: `一郎がはなこを登録`. */
export const historySentence = (line: HistoryLine): string =>
  `${line.who}が${line.text}${line.detail ? `（${line.detail}）` : ''}`
