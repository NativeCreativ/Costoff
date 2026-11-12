'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { TaskLogView } from '@/components/teamWork/TaskLogView';

/** /task-log — everyone records the tasks they worked on. */
export default function TaskLogPage() {
  return (
    <MasterDataPage
      title="Task Log"
      description="Record what you worked on each day — any task, not only demands: task name, details, start and end date, and remarks."
    >
      <TaskLogView />
    </MasterDataPage>
  );
}
