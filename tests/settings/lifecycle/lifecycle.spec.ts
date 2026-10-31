import { test, expect } from '../../../fixtures/test';
import type { LifecyclesApi } from '../../../api/ContactsApi';
import type { Cleanup } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../exclusive';
import { buildLifecycleStage } from '../../../utils/testData';

/** Delete the stage named `name` after the test, if one was created. */
function deleteStageAfterTest(lifecyclesApi: LifecyclesApi, cleanup: Cleanup, name: string): void {
  cleanup.add(`lifecycle stage ${name}`, async () => {
    const stage = (await lifecyclesApi.listRecords()).find((candidate) => candidate.name === name);
    if (stage) await lifecyclesApi.deleteIfExists(stage.id);
  });
}

// The contacts tests read the stages, so these tests run on their own and remove what they add.
test.describe('Settings → Lifecycle', { tag: ['@settings', '@lifecycle'] }, () => {
  runOnlyOnItsOwn();

  test('should open Lifecycle from the Settings menu with every stage', async ({
    lifecycleStagesPage,
    lifecyclesApi,
  }) => {
    await test.step('go to Settings → Lifecycle', () => lifecycleStagesPage.openFromDashboard());
    await test.step('it lists every stage: the pipeline in order, then the lost stages', async () => {
      const stages = await lifecyclesApi.listRecords();
      const inPageOrder = ['lead', 'lost'].flatMap((type) =>
        stages
          .filter((stage) => stage.type === type)
          .sort((a, b) => a.stage - b.stage)
          .map((stage) => stage.name),
      );
      await expect.poll(() => lifecycleStagesPage.names()).toEqual(inPageOrder);
    });
  });

  test('should save a new pipeline stage when user adds one', async ({
    lifecycleStagesPage,
    lifecyclesApi,
    cleanup,
  }) => {
    const { name } = buildLifecycleStage();
    deleteStageAfterTest(lifecyclesApi, cleanup, name);

    await test.step('open Settings → Lifecycle', () => lifecycleStagesPage.open());
    await test.step('add a stage to the pipeline, name it, and save', async () => {
      await lifecycleStagesPage.addPipelineStage(name);
      await lifecycleStagesPage.save();
    });

    await test.step('the server has it as a pipeline stage, before the won stage', async () => {
      const stages = await lifecyclesApi.openStages();
      const added = stages.find((stage) => stage.name === name);
      expect(added).toMatchObject({ type: 'lead', isDefault: false, isWon: false });
      const won = stages.find((stage) => stage.isWon)!;
      expect(added!.stage).toBeLessThan(won.stage);
    });
    await test.step('after a reload it is listed', async () => {
      await lifecycleStagesPage.open();
      expect(await lifecycleStagesPage.names()).toContain(name);
    });
  });

  test('should save the new name when user renames a stage', async ({
    lifecycleStagesPage,
    lifecyclesApi,
    cleanup,
  }) => {
    const original = buildLifecycleStage();
    const renamed = buildLifecycleStage().name;
    const created = await test.step('add a stage to rename (through the API)', async () => {
      const lost = (await lifecyclesApi.listRecords()).filter((stage) => stage.type === 'lost');
      return lifecyclesApi.createRecord({ ...original, type: 'lost', stage: lost.length + 1 });
    });
    cleanup.add(`lifecycle stage ${original.name}`, () => lifecyclesApi.deleteIfExists(created.id));

    await test.step('open Settings → Lifecycle, rename it and save', async () => {
      await lifecycleStagesPage.open();
      await lifecycleStagesPage.renameStage(original.name, renamed);
      await lifecycleStagesPage.save();
    });

    await test.step('the server stored the new name for the same stage', async () => {
      expect((await lifecyclesApi.findRecord(created.id))?.name).toBe(renamed);
    });
  });

  test('should delete a stage once user confirms', async ({
    lifecycleStagesPage,
    lifecyclesApi,
    cleanup,
  }) => {
    const stage = buildLifecycleStage();
    const created = await test.step('add a stage to delete (through the API)', async () => {
      const lost = (await lifecyclesApi.listRecords()).filter((candidate) => candidate.type === 'lost');
      return lifecyclesApi.createRecord({ ...stage, type: 'lost', stage: lost.length + 1 });
    });
    // Safety net only: does nothing if the test deleted it as expected.
    cleanup.add(`lifecycle stage ${stage.name}`, () => lifecyclesApi.deleteIfExists(created.id));

    await test.step('open Settings → Lifecycle and delete it from its Stage actions', async () => {
      await lifecycleStagesPage.open();
      await lifecycleStagesPage.deleteStage(stage.name);
    });

    await test.step('it is gone from the page and the server', async () => {
      expect(await lifecycleStagesPage.names()).not.toContain(stage.name);
      expect(await lifecyclesApi.findRecord(created.id)).toBeUndefined();
    });
  });
});
