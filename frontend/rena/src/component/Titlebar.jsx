import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

function Titlebar() {
  return (
    <AppBar style={{ backgroundImage: "url('EpiwatchHeader.jpg')" }} position="static">
      <Toolbar style={{ paddingLeft: 0 }}>
      <div style={{ backgroundColor: 'white', padding: '5px' }}>
         <img src="/EpiWatch Logos-01.png" alt="My Logo" style={{ maxHeight: '50px', marginRight: '20px' }} />
      </div>
      <Typography variant="h6" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
         Relation Extraction for News Articles (RENA) for epidemic surveillance
      </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default Titlebar;


