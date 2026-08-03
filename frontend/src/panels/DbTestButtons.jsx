import React from 'react';
import api from '../api/api';
import { handleApiError } from '../api/lib';
import { Box, Button } from '@mui/material';
import { useAlert } from '../contexts/AlertContext';

const DbTestButtons = () => {
  const { showAlert } = useAlert();

  const handleDeleteCustomTable = async (tableName) => {
    try {
      const response = await api.post(
        `api/v1/custom-tables/delete/${tableName}`,
      );
      console.log(response.data);
    } catch (error) {
      handleApiError(error);
    }
  };
  const handleGetActiveOverlays = async () => {
    try {
      const overlays = await api.get('api/v1/overlay');
      console.log(overlays.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleAddNewOverlay = async () => {
    const newOverlay = {
      name: 'Overlay Gamma',
      routePath: '/gamma',
      entryFile: 'index.html',
      folderPath:
        'D:\\js_programing\\multi-channel-overlay-service\\backend\\overlays\\overlay-gamma',
    };
    try {
      const response = await api.post('api/v1/overlay', newOverlay);
      console.log(response.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleClick = async () => {
    try {
      const user = await api.get(`api/v1/user`, {
        params: { userName: 'Yinkzs' },
      });
      console.log(user.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleAddUser = async () => {
    const newUser = {
      userName: 'Yinkzs',
      normalizedUserName: 'yinkzs',
      role: 'admin',
    };
    try {
      const response = await api.post('api/v1/user', newUser);
      console.log(response.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleGetCustomTables = async () => {
    try {
      const customTables = await api.get('api/v1/custom-tables');
      console.log(customTables.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleGetCustomTableData = async (tableName) => {
    try {
      const tableData = await api.get(`api/v1/custom-tables/${tableName}`);
      console.log(tableData.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleCreateCustomTable = async () => {
    const newTable = {
      tableName: 'new_table',
      schema: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        created_at: 'TEXT NOT NULL',
      },
    };
    try {
      const response = await api.post('api/v1/custom-tables/create', newTable);
      console.log(response.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const HandleAddCustomTableData = async (tableName, data) => {
    data = {
      id: '2',
      name: 'Sample Name',
      created_at: new Date().toISOString(),
    };

    try {
      const response = await api.post(
        `api/v1/custom-tables/${tableName}`,
        data,
      );
      console.log(response.data);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleUpdateCustomTableData = async (
    tableName,
    key,
    keyValue,
    data,
  ) => {
    try {
      const response = await api.patch(`api/v1/custom-tables/${tableName}`, {
        key,
        keyValue,
        data,
      });
      console.log(response.data);
      showAlert({
        type: 'success',
        message: 'Custom table data updated successfully',
      });
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '300px',
        flexDirection: 'column',
        margin: 'auto',
        gap: 2,
        p: 2,
      }}
    >
      <Button onClick={handleClick}>Get User</Button>
      <Button onClick={handleAddUser}>Add User</Button>
      <Button onClick={handleGetActiveOverlays}>Get Active Overlays</Button>
      <Button onClick={handleAddNewOverlay}>Add New Overlay</Button>
      <Button onClick={handleGetCustomTables}>Get Custom Tables</Button>
      <Button onClick={() => handleGetCustomTableData('nameTable')}>
        Get Custom Table Data
      </Button>
      <Button onClick={handleCreateCustomTable}>Create Custom Table</Button>
      <Button onClick={() => handleDeleteCustomTable('new_table')}>
        Delete Custom Table
      </Button>
      <Button onClick={() => HandleAddCustomTableData('new_table')}>
        Add Custom Table Data
      </Button>
      <Button
        onClick={() =>
          handleUpdateCustomTableData('new_table', 'id', '3', {
            name: 'Updated Name',
            created_at: new Date().toISOString(),
          })
        }
      >
        Update Custom Table Data
      </Button>
    </Box>
  );
};

export default DbTestButtons;
