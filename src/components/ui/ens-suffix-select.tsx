import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

/** Sufixo do nome ENS (Figma: seletor “.eth ⌄”). Hoje a rede só aceita “.eth”. */
export function EnsSuffixSelect({ value = '.eth', onChange }: { value?: '.eth'; onChange?: (v: '.eth') => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange?.(v as '.eth')}>
      <SelectTrigger aria-label="Sufixo do nome ENS" className="h-9 w-[72px] shrink-0 gap-1 px-2 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value=".eth">.eth</SelectItem>
      </SelectContent>
    </Select>
  )
}
