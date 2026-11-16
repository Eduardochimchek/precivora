import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ListPlus } from 'lucide-react';
import { db } from '@/db/database';
import type { ID } from '@/types';
import { Button, Sheet, TextField, useFeedback } from '@/design-system';
import { addListItem, createList } from '@/repositories/lists';
import { parseDecimal } from '@/utils/format';

export function AddToListSheet({ open, onClose, productId, productName }: { open: boolean; onClose: () => void; productId: ID; productName: string }) {
  const { toast } = useFeedback();
  const lists = useLiveQuery(() => db.lists.orderBy('updatedAt').reverse().filter((l) => !l.archived).toArray(), []);
  const [qty, setQty] = useState('1');
  const [newName, setNewName] = useState('');

  async function add(listId: ID, listName: string) {
    const q = parseDecimal(qty);
    if (!(q > 0)) return toast('Quantidade inválida', 'error');
    await addListItem(listId, productId, q);
    toast(`${productName} adicionado a ${listName}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar à lista" description={productName}>
      <div className="flex flex-col gap-4">
        <TextField label="Quantidade" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} wrapperClassName="max-w-[140px]" />
        {lists?.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {lists.map((l) => (
              <li key={l.id}>
                <button onClick={() => add(l.id, l.name)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold hover:bg-sunken">
                  <Check className="h-4 w-4 text-muted" aria-hidden />
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const id = await createList(newName);
              await add(id, newName.trim());
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        >
          <TextField label="Nova lista" placeholder="Ex.: Compra do mês" value={newName} onChange={(e) => setNewName(e.target.value)} wrapperClassName="flex-1" maxLength={80} />
          <Button type="submit" variant="secondary" className="h-12" icon={<ListPlus className="h-4 w-4" />}>
            Criar
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
