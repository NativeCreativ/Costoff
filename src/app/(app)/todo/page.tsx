'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { TodoListView } from '@/components/teamWork/TodoListView';

/** /todo — priority items published by AMs, SPOCs and the Delivery Head, visible to everyone. */
export default function TodoPage() {
  return (
    <MasterDataPage
      title="To-Do List"
      description="Priority items for the whole team. Account Managers, SPOCs and the Delivery Head publish them for a period; everyone sees what is active today."
    >
      <TodoListView />
    </MasterDataPage>
  );
}
