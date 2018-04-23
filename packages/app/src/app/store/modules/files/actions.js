import { clone } from 'mobx-state-tree';
import { getModulePath } from 'common/sandbox/modules';
import getDefinition from 'common/templates';
import { chunk } from 'lodash';
import generateShortid from 'shortid';

import { resolveModuleWrapped } from '../../utils/resolve-module-wrapped';

export function whenModuleIsSelected({ state, props, path }) {
  const currentModule = state.get('editor.currentModule');

  return currentModule.shortid === props.moduleShortid
    ? path.true()
    : path.false();
}

export function massCreateModules({ state, props, api, path }) {
  const { directories, modules, directoryShortid } = props;
  const sandboxId = state.get('editor.currentId');
  const sandbox = state.get('editor.currentSandbox');

  return api
    .post(`/sandboxes/${sandboxId}/modules/mcreate`, {
      directoryShortid,
      modules,
      directories,
    })
    .then(data => {
      state.concat(`editor.sandboxes.${sandbox.id}.modules`, data.modules);
      state.concat(
        `editor.sandboxes.${sandbox.id}.directories`,
        data.directories
      );
      return path.success(data);
    })
    .catch(error => {
      console.error(error);
      return path.error({ error });
    });
}

export function getUploadedFiles({ api, path }) {
  return api
    .get('/users/current_user/uploads')
    .then(data => path.success({ uploadedFilesInfo: data }))
    .catch(error => path.error({ error }));
}

export function deleteUploadedFile({ api, props, path }) {
  return api
    .delete(`/users/current_user/uploads/${props.id}`)
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export async function uploadFiles({ api, props, path }) {
  const chunkedFiles = chunk(props.files, 5);

  const modules = [];

  try {
    // eslint-disable-next-line
    for (const files of chunkedFiles) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        files.map(async file => {
          if (!file.isBinary) {
            modules.push({
              shortid: generateShortid(),
              code: file.code,
              title: file.name,
              isBinary: false,
              directoryShortid: file.directoryShortid,
            });
          } else {
            await api
              .post('/users/current_user/uploads', {
                content: file.content,
                name: file.name,
              })
              .then(data => {
                modules.push({
                  shortid: generateShortid(),
                  code: data.url,
                  title: file.name,
                  isBinary: true,
                  directoryShortid: file.directoryShortid,
                });
              })
              .catch(e => {
                e.message = `Error uploading ${file.name}: ${e.message}`;

                throw e;
              });
          }
        })
      );
    }

    return path.success({ modules, directories: [] });
  } catch (error) {
    console.error(error);
    return path.error({ error: error.message });
  }
}

export function saveNewDirectoryDirectoryShortid({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');
  const shortid = props.shortid;

  return api
    .put(`/sandboxes/${sandboxId}/directories/${shortid}`, {
      directory: { directoryShortid: props.directoryShortid },
    })
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function saveNewModuleDirectoryShortid({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');
  const shortid = props.moduleShortid;

  return api
    .put(`/sandboxes/${sandboxId}/modules/${shortid}`, {
      module: { directoryShortid: props.directoryShortid },
    })
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function createOptimisticModule({ state, props, utils }) {
  const optimisticModule = {
    id: utils.createOptimisticId(),
    title: props.title,
    directoryShortid: props.directoryShortid || null,
    code: props.newCode || '',
    shortid: utils.createOptimisticId(),
    isBinary: props.isBinary === undefined ? false : props.isBinary,
    sourceId: state.get('editor.currentSandbox.sourceId'),
  };

  return { optimisticModule };
}

export function createOptimisticDirectory({ state, props, utils }) {
  const optimisticDirectory = {
    id: utils.createOptimisticId(),
    title: props.title,
    directoryShortid: props.directoryShortid || null,
    shortid: utils.createOptimisticId(),
    sourceId: state.get('editor.currentSandbox.sourceId'),
  };

  return { optimisticDirectory };
}

export function updateOptimisticModule({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  let optimisticModuleIndex = sandbox.modules.findIndex(
    module => module.shortid === props.optimisticModule.shortid
  );

  const existingModule = state.get(
    `editor.sandboxes.${sandbox.id}.modules.${optimisticModuleIndex}`
  );
  const newModule = {
    ...existingModule,
    id: props.newModule.id,
    shortid: props.newModule.shortid,
  };

  state.push(`editor.sandboxes.${sandbox.id}.modules`, newModule);

  if (
    state.get('editor.currentModuleShortid') === props.optimisticModule.shortid
  ) {
    state.set(`editor.currentModuleShortid`, props.newModule.shortid);
  }

  optimisticModuleIndex = sandbox.modules.findIndex(
    module => module.shortid === props.optimisticModule.shortid
  );
  state.splice(
    `editor.sandboxes.${sandbox.id}.modules`,
    optimisticModuleIndex,
    1
  );
}

export function removeOptimisticModule({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const optimisticModuleIndex = sandbox.modules.findIndex(
    module => module.shortid === props.optimisticModule.shortid
  );

  state.splice(
    `editor.sandboxes.${sandbox.id}.modules`,
    optimisticModuleIndex,
    1
  );
}

export function updateOptimisticDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const optimisticDirectoryIndex = sandbox.directories.findIndex(
    directory => directory.shortid === props.optimisticDirectory.shortid
  );

  state.merge(
    `editor.sandboxes.${sandbox.id}.directories.${optimisticDirectoryIndex}`,
    {
      id: props.newDirectory.id,
      shortid: props.newDirectory.shortid,
    }
  );
}

export function removeOptimisticDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const optimisticDirectoryndex = sandbox.directories.findIndex(
    directory => directory.shortid === props.optimisticDirectory.shortid
  );

  state.splice(
    `editor.sandboxes.${sandbox.id}.directories`,
    optimisticDirectoryndex,
    1
  );
}

export function moveDirectoryToDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const directoryIndex = sandbox.directories.findIndex(
    directory => directory.shortid === props.shortid
  );
  const currentDirectoryShortid = state.get(
    `editor.sandboxes.${
      sandbox.id
    }.directories.${directoryIndex}.directoryShortid`
  );

  state.set(
    `editor.sandboxes.${
      sandbox.id
    }.directories.${directoryIndex}.directoryShortid`,
    props.directoryShortid
  );

  return { currentDirectoryShortid };
}

export function revertMoveDirectoryToDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const directoryIndex = sandbox.directories.findIndex(
    directory => directory.shortid === props.shortid
  );

  state.set(
    `editor.sandboxes.${
      sandbox.id
    }.directories.${directoryIndex}.directoryShortid`,
    props.currentDirectoryShortid
  );
}

export function revertMoveModuleToDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const moduleIndex = sandbox.modules.findIndex(
    module => module.shortid === props.moduleShortid
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.modules.${moduleIndex}.directoryShortid`,
    props.currentDirectoryShortid
  );
}

export function moveModuleToDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const moduleIndex = sandbox.modules.findIndex(
    module => module.shortid === props.moduleShortid
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.modules.${moduleIndex}.directoryShortid`,
    props.directoryShortid
  );
}

export function deleteDirectory({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');

  return api
    .delete(
      `/sandboxes/${sandboxId}/directories/${props.removedDirectory.shortid}`
    )
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function removeDirectory({ state, props }) {
  const sandboxId = state.get('editor.currentId');
  const sandbox = state.get('editor.currentSandbox');
  const directoryIndex = sandbox.directories.findIndex(
    directoryEntry => directoryEntry.shortid === props.directoryShortid
  );
  const removedDirectory = clone(sandbox.directories[directoryIndex]);

  state.splice(`editor.sandboxes.${sandboxId}.directories`, directoryIndex, 1);

  return { removedDirectory };
}

export function saveNewDirectoryName({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');
  const sandbox = state.get('editor.currentSandbox');
  const directory = sandbox.directories.find(
    directoryEntry => directoryEntry.shortid === props.directoryShortid
  );

  return api
    .put(`/sandboxes/${sandboxId}/directories/${directory.shortid}`, {
      directory: { title: props.title },
    })
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function renameDirectory({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const directoryIndex = sandbox.directories.findIndex(
    directoryEntry => directoryEntry.shortid === props.directoryShortid
  );
  const oldTitle = state.get(
    `editor.sandboxes.${sandbox.id}.directories.${directoryIndex}.title`
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.directories.${directoryIndex}.title`,
    props.title
  );

  return { oldTitle };
}

export function deleteModule({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');

  return api
    .delete(`/sandboxes/${sandboxId}/modules/${props.removedModule.shortid}`)
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function saveDirectory({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');

  return api
    .post(`/sandboxes/${sandboxId}/directories`, {
      directory: {
        title: props.title,
        directoryShortid: props.directoryShortid,
      },
    })
    .then(data => path.success({ newDirectory: data }))
    .catch(error => path.error({ error }));
}

export function whenCloseTab({ state, props, path }) {
  const sandbox = state.get('editor.currentSandbox');
  const module = sandbox.modules.find(
    moduleEntry => moduleEntry.shortid === props.moduleShortid
  );
  const tabs = state.get('editor.tabs');
  const tabIndex = module
    ? tabs.findIndex(tab => tab.moduleShortid === module.shortid)
    : -1;

  return tabIndex >= 0 ? path.true({ tabIndex }) : path.false();
}

export function removeModule({ state, props }) {
  const sandboxId = state.get('editor.currentId');
  const sandbox = state.get('editor.currentSandbox');
  const moduleIndex = sandbox.modules.findIndex(
    moduleEntry => moduleEntry.shortid === props.moduleShortid
  );
  const moduleCopy = clone(sandbox.modules[moduleIndex]);

  state.splice(`editor.sandboxes.${sandboxId}.modules`, moduleIndex, 1);

  return {
    removedModule: moduleCopy,
  };
}

export function saveNewModule({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');

  return api
    .post(`/sandboxes/${sandboxId}/modules`, {
      module: {
        title: props.title,
        directoryShortid: props.directoryShortid,
        code: props.newCode || '',
        isBinary: props.isBinary === undefined ? false : props.isBinary,
      },
    })
    .then(data => path.success({ newModule: data }))
    .catch(error => path.error({ error }));
}

export function saveNewModuleName({ api, state, props, path }) {
  const sandboxId = state.get('editor.currentId');
  const sandbox = state.get('editor.currentSandbox');
  const module = sandbox.modules.find(
    moduleEntry => moduleEntry.shortid === props.moduleShortid
  );

  return api
    .put(`/sandboxes/${sandboxId}/modules/${module.shortid}`, {
      module: { title: props.title },
    })
    .then(() => path.success())
    .catch(error => path.error({ error }));
}

export function renameModule({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const moduleIndex = sandbox.modules.findIndex(
    moduleEntry => moduleEntry.shortid === props.moduleShortid
  );
  const oldTitle = state.get(
    `editor.sandboxes.${sandbox.id}.modules.${moduleIndex}.title`
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.modules.${moduleIndex}.title`,
    props.title
  );

  return { oldTitle };
}

export function revertModuleName({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const moduleIndex = sandbox.modules.findIndex(
    moduleEntry => moduleEntry.shortid === props.moduleShortid
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.modules.${moduleIndex}.title`,
    props.oldTitle
  );
}

export function revertDirectoryName({ state, props }) {
  const sandbox = state.get('editor.currentSandbox');
  const directoryIndex = sandbox.directories.findIndex(
    directory => directory.shortid === props.directoryShortid
  );

  state.set(
    `editor.sandboxes.${sandbox.id}.directories.${directoryIndex}.title`,
    props.oldTitle
  );
}

export function setDefaultNewCode({ state, props }) {
  if (!props.optimisticModule || props.optimisticModule.code) {
    return {};
  }

  const sandbox = state.get('editor.currentSandbox');

  const path = getModulePath(
    sandbox.modules,
    sandbox.directories,
    props.optimisticModule.id
  );

  const template = getDefinition(sandbox.template);
  const config = template.configurationFiles[path];

  if (
    config &&
    (config.generateFileFromSandbox ||
      config.getDefaultCode ||
      config.generateFileFromState)
  ) {
    let code = '';

    if (config.generateFileFromState) {
      code = config.generateFileFromState(state);
    } else if (config.generateFileFromSandbox) {
      code = config.generateFileFromSandbox(sandbox);
    } else {
      const resolveModule = resolveModuleWrapped(sandbox);

      code = config.getDefaultCode(sandbox.template, resolveModule);
    }

    const optimisticModuleIndex = sandbox.modules.findIndex(
      module => module.shortid === props.optimisticModule.shortid
    );

    state.merge(
      `editor.sandboxes.${sandbox.id}.modules.${optimisticModuleIndex}`,
      {
        code,
      }
    );

    return {
      newCode: code,
      optimisticModule: { ...props.optimisticModule, code },
    };
  }

  return {};
}
