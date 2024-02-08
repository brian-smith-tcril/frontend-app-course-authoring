import {
  render,
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactDOM from 'react-dom';
import { saveAs } from 'file-saver';

import { initializeMockApp } from '@edx/frontend-platform';
import MockAdapter from 'axios-mock-adapter';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { AppProvider } from '@edx/frontend-platform/react';
import { IntlProvider } from '@edx/frontend-platform/i18n';

import initializeStore from '../../store';
import { executeThunk } from '../../utils';
import { RequestStatus } from '../../data/constants';
import FilesPage from './FilesPage';
import {
  generateFetchAssetApiResponse,
  generateEmptyApiResponse,
  generateNewAssetApiResponse,
  getStatusValue,
  courseId,
  initialState,
  generateNextPageResponse,
} from './factories/mockApiResponses';

import {
  fetchAssets,
  addAssetFile,
  deleteAssetFile,
  updateAssetLock,
  getUsagePaths,
} from './data/thunks';
import { getAssetsUrl } from './data/api';
import messages from '../generic/messages';

let axiosMock;
let store;
let file;
ReactDOM.createPortal = jest.fn(node => node);
jest.mock('file-saver');

const renderComponent = () => {
  render(
    <IntlProvider locale="en">
      <AppProvider store={store}>
        <FilesPage courseId={courseId} />
      </AppProvider>
    </IntlProvider>,
  );
};

const mockStore = async (
  status,
  skipNextPageFetch,
) => {
  const fetchAssetsUrl = `${getAssetsUrl(courseId)}?page=0`;
  axiosMock.onGet(fetchAssetsUrl).reply(getStatusValue(status), generateFetchAssetApiResponse());
  if (!skipNextPageFetch) {
    const nextPageUrl = `${getAssetsUrl(courseId)}?page=1`;
    axiosMock.onGet(nextPageUrl).reply(getStatusValue(status), generateNextPageResponse());
  }
  renderComponent();
  await executeThunk(fetchAssets(courseId), store.dispatch);
};

const emptyMockStore = async (status) => {
  const fetchAssetsUrl = `${getAssetsUrl(courseId)}?page=0`;
  axiosMock.onGet(fetchAssetsUrl).reply(getStatusValue(status), generateEmptyApiResponse());
  renderComponent();
  await executeThunk(fetchAssets(courseId), store.dispatch);
};

describe('FilesAndUploads', () => {
  describe('empty state', () => {
    beforeEach(async () => {
      initializeMockApp({
        authenticatedUser: {
          userId: 3,
          username: 'abc123',
          administrator: false,
          roles: [],
        },
      });
      store = initializeStore({
        ...initialState,
        assets: {
          ...initialState.assets,
          assetIds: [],
        },
        models: {},
      });
      axiosMock = new MockAdapter(getAuthenticatedHttpClient());
      file = new File(['(⌐□_□)'], 'download.png', { type: 'image/png' });
    });

    it('should return placeholder component', async () => {
      await mockStore(RequestStatus.DENIED);

      expect(screen.getByTestId('under-construction-placeholder')).toBeVisible();
    });

    it('should have Files title', async () => {
      await emptyMockStore(RequestStatus.SUCCESSFUL);

      expect(screen.getByText('Files')).toBeVisible();
    });

    it('should render dropzone', async () => {
      await emptyMockStore(RequestStatus.SUCCESSFUL);

      expect(screen.getByTestId('files-dropzone')).toBeVisible();

      expect(screen.queryByTestId('files-data-table')).toBeNull();
    });

    it('should upload a single file', async () => {
      await emptyMockStore(RequestStatus.SUCCESSFUL);
      const dropzone = screen.getByTestId('files-dropzone');
      axiosMock.onPost(getAssetsUrl(courseId)).reply(204, generateNewAssetApiResponse());
      Object.defineProperty(dropzone, 'files', {
        value: [file],
      });
      await act(async () => {
        fireEvent.drop(dropzone);
      });
      await waitFor(() => {
        executeThunk(addAssetFile(courseId, file, 0), store.dispatch);
      });
      const addStatus = store.getState().assets.addingStatus;
      expect(addStatus).toEqual(RequestStatus.SUCCESSFUL);

      expect(screen.queryByTestId('files-dropzone')).toBeNull();

      expect(screen.getByTestId('files-data-table')).toBeVisible();
    });
  });

  describe('valid assets', () => {
    beforeEach(async () => {
      initializeMockApp({
        authenticatedUser: {
          userId: 3,
          username: 'abc123',
          administrator: false,
          roles: [],
        },
      });
      store = initializeStore(initialState);
      axiosMock = new MockAdapter(getAuthenticatedHttpClient());
      file = new File(['(⌐□_□)'], 'download.png', { type: 'image/png' });
    });

    afterEach(() => {
      saveAs.mockClear();
    });

    describe('table view', () => {
      it('should render table with gallery card', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        expect(screen.getByTestId('files-data-table')).toBeVisible();

        await waitFor(() => {
          expect(screen.getAllByTestId('grid-card-mOckID1')[0]).toBeVisible();
        });
      });

      it('should switch table to list view', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        expect(screen.getByTestId('files-data-table')).toBeVisible();

        await waitFor(() => {
          expect(screen.getAllByTestId('grid-card-mOckID1')[0]).toBeVisible();
        });

        expect(screen.queryByRole('table')).toBeNull();

        const listButton = screen.getByLabelText('List');
        await userEvent.click(listButton);
        expect(screen.queryByTestId('grid-card-mOckID1')).toBeNull();

        expect(screen.getByRole('table')).toBeVisible();
      });
    });

    describe('table actions', () => {
      it('should upload a single file', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        axiosMock.onPost(getAssetsUrl(courseId)).reply(200, generateNewAssetApiResponse());
        let addFilesButton;

        addFilesButton = screen.getByLabelText('file-input');
        await userEvent.upload(addFilesButton, file);
        await waitFor(() => {
          executeThunk(addAssetFile(courseId, file, 1), store.dispatch);
        });
        const addStatus = store.getState().assets.addingStatus;
        expect(addStatus).toEqual(RequestStatus.SUCCESSFUL);
      });

      it('should have disabled action buttons', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        let actionsButton;

        actionsButton = screen.getByText(messages.actionsButtonLabel.defaultMessage);
        await userEvent.click(actionsButton);
        expect(screen.getByText(messages.downloadTitle.defaultMessage).closest('a')).toHaveClass('disabled');

        expect(screen.getByText(messages.deleteTitle.defaultMessage).closest('a')).toHaveClass('disabled');
      });

      it('delete button should be enabled and delete selected file', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        let selectCardButton;

        await waitFor(() => {
          [selectCardButton] = screen.getAllByTestId('datatable-select-column-checkbox-cell');
        });

        await userEvent.click(selectCardButton);

        const actionsButton = screen.getByText(messages.actionsButtonLabel.defaultMessage);
        expect(actionsButton).toBeVisible();

        await userEvent.click(actionsButton);
        const deleteButton = screen.getByText(messages.deleteTitle.defaultMessage).closest('a');
        expect(deleteButton).not.toHaveClass('disabled');

        axiosMock.onDelete(`${getAssetsUrl(courseId)}mOckID1`).reply(204);

        await userEvent.click(deleteButton);
        expect(screen.getByText('Delete file(s) confirmation')).toBeVisible();
        await userEvent.click(deleteButton);

        // Wait for the delete confirmation button to appear
        const confirmDeleteButton = await screen.findByRole('button', {
          name: messages.deleteFileButtonLabel.defaultMessage,
        });

        await waitFor(() => {
          userEvent.click(confirmDeleteButton);
        });
        expect(screen.queryByText('Delete file(s) confirmation')).toBeNull();

        // Check if the asset is deleted in the store and UI
        const deleteStatus = store.getState().assets.deletingStatus;
        expect(deleteStatus).toEqual(RequestStatus.SUCCESSFUL);
        expect(screen.queryByTestId('grid-card-mOckID1')).toBeNull();
      });

      it('download button should be enabled and download single selected file', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const selectCardButton = screen.getAllByTestId('datatable-select-column-checkbox-cell')[0];
        await userEvent.click(selectCardButton);
        const actionsButton = screen.getByText(messages.actionsButtonLabel.defaultMessage);
        expect(actionsButton).toBeVisible();

        
        await userEvent.click(actionsButton);
        const downloadButton = screen.getByText(messages.downloadTitle.defaultMessage).closest('a');
        expect(downloadButton).not.toHaveClass('disabled');

        await userEvent.click(downloadButton);
        expect(saveAs).toHaveBeenCalled();
      });

      it('download button should be enabled and download multiple selected files', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const selectCardButtons = screen.getAllByTestId('datatable-select-column-checkbox-cell');
        await userEvent.click(selectCardButtons[0]);
        await userEvent.click(selectCardButtons[1]);
        const actionsButton = screen.getByText(messages.actionsButtonLabel.defaultMessage);
        expect(actionsButton).toBeVisible();

        
        await userEvent.click(actionsButton);
        
        const mockResponseData = { ok: true, blob: () => 'Data' };
        const mockFetchResponse = Promise.resolve(mockResponseData);
        const downloadButton = screen.getByText(messages.downloadTitle.defaultMessage).closest('a');
        expect(downloadButton).not.toHaveClass('disabled');

        global.fetch = jest.fn().mockImplementation(() => mockFetchResponse);
        await userEvent.click(downloadButton);
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      it('sort button should be enabled and sort files by name', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const sortsButton = screen.getByText(messages.sortButtonLabel.defaultMessage);
        expect(sortsButton).toBeVisible();

        await userEvent.click(sortsButton);
        expect(screen.getByText(messages.sortModalTitleLabel.defaultMessage)).toBeVisible();

        const sortNameAscendingButton = screen.getByText(messages.sortByNameAscending.defaultMessage);
        await userEvent.click(sortNameAscendingButton);

        await userEvent.click(screen.getByText(messages.applySortButton.defaultMessage));

        expect(screen.queryByText(messages.sortModalTitleLabel.defaultMessage)).toBeNull();
      });

      it('sort button should be enabled and sort files by file size', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const sortsButton = screen.getByText(messages.sortButtonLabel.defaultMessage);
        expect(sortsButton).toBeVisible();

        await userEvent.click(sortsButton);
        expect(screen.getByText(messages.sortModalTitleLabel.defaultMessage)).toBeVisible();

        const sortBySizeDescendingButton = screen.getByText(messages.sortBySizeDescending.defaultMessage);
        await userEvent.click(sortBySizeDescendingButton);

        await userEvent.click(screen.getByText(messages.applySortButton.defaultMessage));

        expect(screen.queryByText(messages.sortModalTitleLabel.defaultMessage)).toBeNull();
      });
    });

    describe('card menu actions', () => {
      it('should open asset info', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        let assetMenuButton;

        await waitFor(() => {
          [assetMenuButton] = screen.getAllByTestId('file-menu-dropdown-mOckID1');
        });

        axiosMock.onGet(`${getAssetsUrl(courseId)}mOckID1/usage`)
          .reply(201, {
            usage_locations: {
              mOckID1: [{
                display_location: 'subsection - unit / block',
                url: 'base/unit_id#block_id',
              }],
            },
          });
        
        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Info'));

        await waitFor(() => {
          executeThunk(getUsagePaths({
            courseId,
            asset: { id: 'mOckID1', displayName: 'mOckID1' },
            setSelectedRows: jest.fn(),
          }), store.dispatch);
        });

        expect(screen.getAllByLabelText('mOckID1')[0]).toBeVisible();

        const { usageStatus } = store.getState().assets;
        expect(usageStatus).toEqual(RequestStatus.SUCCESSFUL);
        expect(screen.getByText('subsection - unit / block')).toBeVisible();
      });

      it('should open asset info and handle lock checkbox', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID1')[0];

        axiosMock.onPut(`${getAssetsUrl(courseId)}mOckID1`).reply(201, { locked: false });
        axiosMock.onGet(`${getAssetsUrl(courseId)}mOckID1/usage`).reply(201, { usage_locations: { mOckID1: [] } });

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Info'));

        await waitFor(() => {
          executeThunk(getUsagePaths({
            courseId,
            asset: { id: 'mOckID1', displayName: 'mOckID1' },
            setSelectedRows: jest.fn(),
          }), store.dispatch);
        });

        expect(screen.getAllByLabelText('mOckID1')[0]).toBeVisible();

        await userEvent.click(screen.getByLabelText('Checkbox'));
        
        await waitFor(() => {
          executeThunk(updateAssetLock({
            courseId,
            assetId: 'mOckID1',
            locked: false,
          }), store.dispatch);
        });
        expect(screen.getByText(messages.usageNotInUseMessage.defaultMessage)).toBeVisible();

        const updateStatus = store.getState().assets.updatingStatus;
        expect(updateStatus).toEqual(RequestStatus.SUCCESSFUL);
      });

      it('should unlock asset', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID1')[0];

        axiosMock.onPut(`${getAssetsUrl(courseId)}mOckID1`).reply(201, { locked: false });
        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Unlock'));

        await waitFor(() => {
          executeThunk(updateAssetLock({
            courseId,
            assetId: 'mOckID1',
            locked: false,
          }), store.dispatch);
        });
        const updateStatus = store.getState().assets.updatingStatus;
        expect(updateStatus).toEqual(RequestStatus.SUCCESSFUL);
      });

      it('should lock asset', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID3')[0];

        axiosMock.onPut(`${getAssetsUrl(courseId)}mOckID3`).reply(201, { locked: true });

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Lock'));

        await waitFor(() => {
          executeThunk(updateAssetLock({
            courseId,
            assetId: 'mOckID3',
            locked: true,
          }), store.dispatch);
        });
        const updateStatus = store.getState().assets.updatingStatus;
        expect(updateStatus).toEqual(RequestStatus.SUCCESSFUL);
      });

      it('download button should download file', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID1')[0];

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Download'));
        expect(saveAs).toHaveBeenCalled();
      });

      it('delete button should delete file', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID1')[0];

        axiosMock.onDelete(`${getAssetsUrl(courseId)}mOckID1`).reply(204);

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByTestId('open-delete-confirmation-button'));

        expect(screen.getByText('Delete file(s) confirmation')).toBeVisible();

        await userEvent.click(screen.getByText(messages.deleteFileButtonLabel.defaultMessage));
        
        expect(screen.queryByText('Delete file(s) confirmation')).toBeNull();

        await waitFor(() => {
          executeThunk(deleteAssetFile(courseId, 'mOckID1', 5), store.dispatch);
        });
        const deleteStatus = store.getState().assets.deletingStatus;
        expect(deleteStatus).toEqual(RequestStatus.SUCCESSFUL);

        expect(screen.queryByTestId('grid-card-mOckID1')).toBeNull();
      });
    });

    describe('api errors', () => {
      it('404 intitial fetch should show error', async () => {
        await mockStore(RequestStatus.FAILED);
        const { loadingStatus } = store.getState().assets;
        await waitFor(() => {
          expect(screen.getByText('Error')).toBeVisible();
        });

        expect(loadingStatus).toEqual(RequestStatus.FAILED);
        expect(screen.getByText('Failed to load all files.')).toBeVisible();
      });

      it('404 intitial fetch should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL, true);
        const { loadingStatus } = store.getState().assets;
        await waitFor(() => {
          expect(screen.getByText('Error')).toBeVisible();
        });

        expect(loadingStatus).toEqual(RequestStatus.PARTIAL_FAILURE);
        expect(screen.getByText('Failed to load remaining files.')).toBeVisible();
      });

      it('invalid file size should show error', async () => {
        const errorMessage = 'File download.png exceeds maximum size of 20 MB.';
        await mockStore(RequestStatus.SUCCESSFUL);

        axiosMock.onPost(getAssetsUrl(courseId)).reply(413, { error: errorMessage });
        const addFilesButton = screen.getByLabelText('file-input');
        await waitFor(() => {
          userEvent.upload(addFilesButton, file);
        });
        const addStatus = store.getState().assets.addingStatus;
        expect(addStatus).toEqual(RequestStatus.FAILED);

        expect(screen.getByText('Error')).toBeVisible();
      });

      it('404 upload should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        axiosMock.onPost(getAssetsUrl(courseId)).reply(404);
        const addFilesButton = screen.getByLabelText('file-input');
        await userEvent.upload(addFilesButton, file);
        await act(async () => {
          await executeThunk(addAssetFile(courseId, file, 1), store.dispatch);
        });
        const addStatus = store.getState().assets.addingStatus;
        expect(addStatus).toEqual(RequestStatus.FAILED);

        expect(screen.getByText('Error')).toBeVisible();
      });

      it('404 delete should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID3')[0];

        axiosMock.onDelete(`${getAssetsUrl(courseId)}mOckID3`).reply(404);

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByTestId('open-delete-confirmation-button'));

        expect(screen.getByText('Delete file(s) confirmation')).toBeVisible();

        await userEvent.click(screen.getByText(messages.deleteFileButtonLabel.defaultMessage));

        expect(screen.queryByText('Delete file(s) confirmation')).toBeNull();

        await waitFor(() => {
          executeThunk(deleteAssetFile(courseId, 'mOckID3', 5), store.dispatch);
        });
        const deleteStatus = store.getState().assets.deletingStatus;
        expect(deleteStatus).toEqual(RequestStatus.FAILED);

        expect(screen.getAllByTestId('grid-card-mOckID3')[0]).toBeVisible();

        expect(screen.getByText('Error')).toBeVisible();
      });

      it('404 usage path fetch should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID3')[0];

        axiosMock.onGet(`${getAssetsUrl(courseId)}mOckID3/usage`).reply(404);
        
        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Info'));
        await waitFor(() => {
          executeThunk(getUsagePaths({
            courseId,
            asset: { id: 'mOckID3', displayName: 'mOckID3' },
            setSelectedRows: jest.fn(),
          }), store.dispatch);
        });
        const { usageStatus } = store.getState().assets;
        expect(usageStatus).toEqual(RequestStatus.FAILED);
      });

      it('404 lock update should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);

        const assetMenuButton = screen.getAllByTestId('file-menu-dropdown-mOckID3')[0];

        axiosMock.onPut(`${getAssetsUrl(courseId)}mOckID3`).reply(404);

        await userEvent.click(within(assetMenuButton).getByLabelText('file-menu-toggle'));
        await userEvent.click(screen.getByText('Lock'));

        await waitFor(() => {
          executeThunk(updateAssetLock({
            courseId,
            assetId: 'mOckID3',
            locked: true,
          }), store.dispatch);
        });
        const updateStatus = store.getState().assets.updatingStatus;
        expect(updateStatus).toEqual(RequestStatus.FAILED);

        expect(screen.getByText('Error')).toBeVisible();
      });

      it('multiple asset file fetch failure should show error', async () => {
        await mockStore(RequestStatus.SUCCESSFUL);
        const selectCardButtons = screen.getAllByTestId('datatable-select-column-checkbox-cell');
        await userEvent.click(selectCardButtons[0]);
        await userEvent.click(selectCardButtons[1]);
        const actionsButton = screen.getByText(messages.actionsButtonLabel.defaultMessage);
        expect(actionsButton).toBeVisible();

        await userEvent.click(actionsButton);

        const mockResponseData = { ok: false };
        const mockFetchResponse = Promise.resolve(mockResponseData);
        const downloadButton = screen.getByText(messages.downloadTitle.defaultMessage).closest('a');
        expect(downloadButton).not.toHaveClass('disabled');

        global.fetch = jest.fn().mockImplementation(() => mockFetchResponse); 
        await userEvent.click(downloadButton);
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledTimes(2);
        });

        const updateStatus = store.getState().assets.updatingStatus;
        expect(updateStatus).toEqual(RequestStatus.FAILED);

        expect(screen.getByText('Error')).toBeVisible();
      });
    });
  });
});
