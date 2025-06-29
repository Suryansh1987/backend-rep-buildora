import React, { useState } from 'react';
import { Box, Card, Grid, Typography, Button, IconButton, Switch, useTheme } from '@mui/material';
import { styled } from '@mui/system';
import SchoolIcon from '@mui/icons-material/School';
import TimelineIcon from '@mui/icons-material/Timeline';
import EventIcon from '@mui/icons-material/Event';
import HistoryIcon from '@mui/icons-material/History';
import RecommendIcon from '@mui/icons-material/Recommend';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Zap, BookOpen, Activity, Calendar, Clock, ThumbsUp } from 'lucide-react';

const StyledCard = styled(Card)(({ theme }) => ({
  padding: '24px',
  borderRadius: '16px',
  boxShadow: '0 6px 16px rgba(255,215,0,0.1)',
  backgroundColor: '#FFFFFF',
  border: '1px solid #FFD700',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 12px 24px rgba(255,215,0,0.2)',
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '16px',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#FFD700',
  color: '#FFFFFF',
  padding: '12px 24px',
  borderRadius: '30px',
  textTransform: 'none',
  fontSize: '18px',
  fontWeight: '600',
  transition: 'all 0.3s ease',
  '&:hover': { 
    backgroundColor: '#F0C000',
    transform: 'scale(1.05)',
  }
}));

const DarkModeSwitch = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: '24px',
  right: '24px',
  display: 'flex',
  alignItems: 'center',
  zIndex: 1000,
}));

const DashboardPage: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const theme = useTheme();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const mockData = {
    courses: [
      { id: 1, title: "Maquillaje de Novia Clásico", progress: 75 },
      { id: 2, title: "Técnicas Avanzadas de Contorno", progress: 40 },
      { id: 3, title: "Maquillaje para Fotografía", progress: 90 },
    ],
    events: [
      { id: 1, title: "Masterclass: Tendencias 2023", date: "2023-08-15" },
      { id: 2, title: "Webinar: Maquillaje para Pieles Maduras", date: "2023-09-01" },
    ],
    recentActivity: [
      { id: 1, action: "Completaste el módulo 3 de Maquillaje de Novia Clásico", date: "2023-07-28" },
      { id: 2, action: "Obtuviste el certificado en Técnicas de Iluminación", date: "2023-07-25" },
    ],
  };

  return (
    <Box sx={{ padding: '32px', backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
      <DarkModeSwitch>
        <IconButton sx={{ mr: 1 }} onClick={toggleDarkMode} color="inherit">
          {darkMode ? <Brightness7Icon sx={{ color: '#FFD700' }} /> : <Brightness4Icon sx={{ color: '#FFD700' }} />}
        </IconButton>
        <Switch
          checked={darkMode}
          onChange={toggleDarkMode}
          color="primary"
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: '#FFD700',
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: '#FFD700',
            },
          }}
        />
      </DarkModeSwitch>
      
      <Typography variant="h3" gutterBottom sx={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '32px', textAlign: 'center' }}>
        Panel de Maquillaje Nupcial
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <StyledCard>
            <IconWrapper>
              <BookOpen size={32} color="#FFD700" style={{ marginRight: '16px' }} />
              <Typography variant="h5" sx={{ color: '#FFD700' }}>Mis Cursos</Typography>
            </IconWrapper>
            {mockData.courses.map((course) => (
              <Box key={course.id} sx={{ marginBottom: '16px' }}>
                <Typography variant="subtitle1" sx={{ color: '#000000' }}>{course.title}</Typography>
                <Box sx={{ width: '100%', backgroundColor: '#F0F0F0', borderRadius: '10px', height: '10px' }}>
                  <Box sx={{ width: `${course.progress}%`, backgroundColor: '#FFD700', height: '100%', borderRadius: '10px' }} />
                </Box>
              </Box>
            ))}
            <ActionButton fullWidth>Ver Todos los Cursos</ActionButton>
          </StyledCard>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <StyledCard>
            <IconWrapper>
              <Calendar size={32} color="#FFD700" style={{ marginRight: '16px' }} />
              <Typography variant="h5" sx={{ color: '#FFD700' }}>Próximos Eventos</Typography>
            </IconWrapper>
            {mockData.events.map((event) => (
              <Box key={event.id} sx={{ marginBottom: '16px' }}>
                <Typography variant="subtitle1" sx={{ color: '#000000' }}>{event.title}</Typography>
                <Typography variant="body2" sx={{ color: '#666666' }}>{event.date}</Typography>
              </Box>
            ))}
            <ActionButton fullWidth>Ver Calendario Completo</ActionButton>
          </StyledCard>
        </Grid>
        
        <Grid item xs={12}>
          <StyledCard>
            <IconWrapper>
              <Clock size={32} color="#FFD700" style={{ marginRight: '16px' }} />
              <Typography variant="h5" sx={{ color: '#FFD700' }}>Actividad Reciente</Typography>
            </IconWrapper>
            {mockData.recentActivity.map((activity) => (
              <Box key={activity.id} sx={{ marginBottom: '16px' }}>
                <Typography variant="subtitle1" sx={{ color: '#000000' }}>{activity.action}</Typography>
                <Typography variant="body2" sx={{ color: '#666666' }}>{activity.date}</Typography>
              </Box>
            ))}
            <ActionButton fullWidth>Ver Todo el Historial</ActionButton>
          </StyledCard>
        </Grid>
      </Grid>
      
      <Box sx={{ marginTop: '48px', display: 'flex', justifyContent: 'center' }}>
        <ActionButton size="large" sx={{ fontSize: '20px', padding: '16px 32px' }}>
          Explorar Nuevas Técnicas de Maquillaje
        </ActionButton>
      </Box>
    </Box>
  );
};

export default DashboardPage;