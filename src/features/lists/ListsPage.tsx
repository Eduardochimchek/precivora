import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListChecks, Plus } from 'lucide-react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, ListSkeleton, ProgressBar, Segmented, Sheet, TextField, useFeedback } from '@/design-system';
import { createList } from '@/repositories/lists';
import { relativeDays } from '@/utils/date';
import { useNavigate } from 'react-router-dom';

export default function ListsPage() {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const lists = useLiveQuery(() => db.lists.orderBy('updatedAt').reverse().toArray(), []);
  const items = useLiveQuery(() => db.listItems.toArray(), []);
  const [tab, setTab] = useState<'ativas' | 'arquivadas'>('ativas');
  const [creating, setCreating] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  const visible = (lists ?? []).filter((l) => (tab === 'ativas' ? !l.archived : l.archived));

  return (
    <div>
      <PageHeader
        title="Listas"
        subtitle="Planeje a compra e veja onde sai mais barato."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Nova
          </Button>
        }
      />
      <Segmented label="Situação" value={tab} onChange={setTab} options={[{ value: 'ativas', label: 'Ativas' }, { value: 'arquivadas', label: 'Arquivadas' }]} className="mb-4" />
      {!lists || !items ? (
        <ListSkeleton rows={3} />
      ) : !visible.length ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title={tab === 'ativas' ? 'Nenhuma lista ainda' : 'Nenhuma lista arquivada'}
          action={tab === 'ativas' ? <Button onClick={() => setCreating(true)}>Criar lista</Button> : undefined}
        >
          {tab === 'ativas' ? 'Monte a lista com seus produtos e o Precivora calcula o total em cada lugar.' : undefined}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visible.map((l) => {
            const its = items.filter((i) => i.listId === l.id);
            const done = its.filter((i) => i.checked).length;
            return (
              <li key={l.id}>
                <Link to={`/listas/${l.id}`} className="flex h-full flex-col gap-3 rounded-lg bg-surface p-4 shadow-card hover:bg-sunken">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg font-bold leading-tight">{l.name}</span>
                    <Chip>{its.length} {its.length === 1 ? 'item' : 'itens'}</Chip>
                  </div>
                  {its.length > 0 && <ProgressBar value={done / its.length} label={`${done} de ${its.length} comprados`} />}
                  <span className="text-xs text-muted">
                    {its.length ? `${done} de ${its.length} comprados · ` : ''}atualizada {relativeDays(l.updatedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova lista"
        footer={
          <Button type="submit" form="new-list" block loading={savingList}>
            Criar lista
          </Button>
        }
      >
        <form
          id="new-list"
          onSubmit={async (e) => {
            e.preventDefault();
            if (savingList) return;
            setSavingList(true);
            try {
              const id = await createList(name);
              setCreating(false);
              setName('');
              toast('Lista criada');
              navigate(`/listas/${id}`);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setSavingList(false);
            }
          }}
        >
          <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="Ex.: Compra do mês" maxLength={80} data-autofocus />
        </form>
      </Sheet>
    </div>
  );
}
