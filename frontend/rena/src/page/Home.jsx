import React, { useState, useCallback, useRef } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import { apiCall } from '../util/api'
import Titlebar from '../component/Titlebar'
import { makeStyles } from '@material-ui/core/styles';
import ReactQuill from 'react-quill';
import 'quill/dist/quill.snow.css';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';

const Home = (props) => {
  const [input, setInput] = React.useState('');
  const [modelname, setModelname] = React.useState('OpenOrca');
  const [maxTokens, setMaxTokens] = React.useState(128);
  const [output, setOutput] = React.useState('');
  const [loadingModel, setLoadingModel] = React.useState(0);
  const [selectedButton, setSelectedButton] = React.useState(2);
  const generate = useRef(true)
  const [outputJson, setOutputJson] = React.useState('');
  const [outputArticle, setOutputArticle] = React.useState('');
  const [outputRaw, setOutputRaw] = React.useState('');
  const [usedEntities, setUsedEntities] = useState({});

  const escapeRegExp = (string) => {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); 
  }
  const tryParse = (articleObject) => {
    let obj = null;
    let tryString = articleObject;
  
    while (tryString.length > 0) {
      try {
        obj = JSON.parse(tryString + ']}');
        return obj;
      } catch (error) {
        tryString = tryString.slice(0, -1);
      }
    }
  
    console.error("Couldn't parse the string even after multiple attempts.");
    return null;
  }

  const tryParse2 = (articleObject) => {
    const items = articleObject.split("\n").filter(line => line.trim());

    const relations = [];
    for (const item of items) {
        const dictStr = item.split(')')[1]?.trim().replace(/'/g, "\""); 
        try {
            relations.push(JSON.parse("{" + dictStr + "}"));
        } catch (error) {
        }
    }
    return {
        relations: relations
    };
  }

  const QuillEditor = () => {
    const quillRef = useRef(null);
    let text = outputArticle[0];
    let relations = outputArticle[1];

    const all_entities = {
      "infectious disease": ["INF", "lightblue"],
      "pathogen": ["PAT", "#d8bfd8"],
      "host": ["HOST", "lightpink"],
      "symptom": ["SYM", "lightyellow"],
      "syndrome": ["SYN", "lightyellow"],
      "confirmed cases": ["CASE", "lightgreen"],
      "overall confirmed cases": ["OCCASE", "lightgreen"],
      "new confirmed cases": ["NCCASE", "lightgreen"],
      "active confirmed cases": ["CCASE", "lightgreen"],
      "overall probable cases": ["OPCASE", "lightgreen"],
      "new probable cases": ["NPCASE", "lightgreen"],
      "active probable cases": ["PCASE", "lightgreen"],
      "overall confirmed and probable cases": ["OTCASE", "lightgreen"],
      "new confirmed and probable cases": ["NTCASE", "lightgreen"],
      "active confirmed and probable cases": ["TCASE", "lightgreen"],
      "confirmed deaths": ["CDEATH", "lightgreen"],
      "overall confirmed deaths": ["OCDEATH", "lightgreen"],
      "probable deaths": ["PDEATH", "lightgreen"],
      "overall probable deaths": ["OPDEATH", "lightgreen"],
      "confirmed and probable deaths": ["TDEATH", "lightgreen"],
      "total confirmed and probable deaths": ["OTDEATH", "lightgreen"],
      "location": ["LOC", "#FFDAB9"],
      "event date": ["DATE", "cyan"],
      "published date": ["PUBLISHED_DATE", "cyan"],
      "reported location": ["REPORTED_LOC", "cyan"],
    };

    const all_relations = {
      "cases of": "#6DBE45",
      "occurred on": "#6495ED",
      "located at": "orange",
      "are symptoms of": "yellow",
      "deaths of": "#ff7f7f",
      "has effect": "#9370DB"
    }

    const newUsedEntities = {};

    React.useEffect(() => {
      const quill = quillRef.current.getEditor();

      const quillContainer = quillRef.current.getEditor().container;
      quillContainer.style.maxHeight = '337px';
      quillContainer.style.overflowY = 'auto';
      quill.formatText(0, text.length, { background: 'transparent', font: 'monospace' });
  
      relations.forEach(relation => {
          Object.entries(relation).forEach(([entityType, entityValue]) => {
              const regex = new RegExp((entityValue), 'gi');
              let match;
              while ((match = regex.exec(text)) !== null) {
                  const index = match.index;
                  const matchedTextLength = match[0].length;
                  if (all_entities[entityType]) {
                      newUsedEntities[entityValue] = [entityType, all_entities[entityType][1]];
                      quill.formatText(index, matchedTextLength, { background: all_entities[entityType][1]});
                  }
              }
          });
      });
      if (JSON.stringify(newUsedEntities) !== JSON.stringify(usedEntities)) {
        setUsedEntities(newUsedEntities);
      }
  }, [text, relations]);

    return (
      <Box>
        <ReactQuill style={{ paddingBottom: '20px' }} ref={quillRef} value={text} readOnly={true} theme="snow" />
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={{ borderRight: '1px solid rgba(224, 224, 224, 1)'}}>Entity Name</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(usedEntities).map(([entityName, [type, color]]) => (
                <TableRow key={entityName} style={{ backgroundColor: color }}>
                  <TableCell style={{ borderRight: '1px solid rgba(224, 224, 224, 1)'}}>{entityName}</TableCell>
                  <TableCell>{type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TableContainer component={Paper} style={{ marginTop: '20px' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={{ borderRight: '1px solid rgba(224, 224, 224, 1)'}}>Entity 1</TableCell>
                <TableCell style={{ borderRight: '1px solid rgba(224, 224, 224, 1)'}}>Relation</TableCell>
                <TableCell style={{ borderRight: '1px solid rgba(224, 224, 224, 1)'}}>Entity 2</TableCell>
              </TableRow>
          </TableHead>
          <TableBody>
            {JSON.parse(outputJson).relations.map((relation, index) => {
              const { relation: rel, ...entities } = relation;
              const keys = Object.keys(entities);
              const entity1Color = all_entities[keys[0]] ? all_entities[keys[0]][1] : undefined;
              const relationColor = all_relations[rel] ? all_relations[rel] : undefined;
              const entity2Color = all_entities[keys[1]] ? all_entities[keys[1]][1] : undefined;
              
              return (
                <TableRow key={index}>
                  <TableCell style={{ backgroundColor: entity1Color, borderRight: '1px solid rgba(224, 224, 224, 1)'}}>{entities[keys[0]]}</TableCell>
                  <TableCell style={{ backgroundColor: relationColor, borderRight: '1px solid rgba(224, 224, 224, 1)'}}>{rel}</TableCell>
                  <TableCell style={{ backgroundColor: entity2Color, borderRight: '1px solid rgba(224, 224, 224, 1)'}}>{entities[keys[1]]}</TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      
    );
  }
  const getPrediction = async () => {
    setSelectedButton(2);
    setLoadingModel(2);
    const params = new URLSearchParams();
    params.append('input', input);
    params.append('max_tokens', maxTokens);
    const url = `http://localhost:8080/predictModel?` + params.toString();

    const response = await fetch(url)
    const reader = response.body.getReader();
    let chunk = ''
    
    while (generate.current) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunk = new TextDecoder().decode(value);
        setOutputRaw(chunk);
        //setOutput(chunk);
    }

    if (modelname === 'StableBeluga-30' || modelname === 'Yahma' || modelname === 'StableBeluga-135' || modelname === 'StableBeluga-135-2' || modelname === 'StableBeluga-135-best') {
      let parsed_chunk = tryParse(chunk);
      if (parsed_chunk !== null) {
        setOutputArticle([input.trimStart(), parsed_chunk['relations']]);
        setOutputJson(JSON.stringify(parsed_chunk));
        setOutputRaw(chunk);
      }
    } else if (modelname !== 'StableBelugaBase') {
      let parsed_chunk = tryParse2(chunk);
      setOutputArticle([input.trimStart(), parsed_chunk['relations']]);
      setOutputJson(JSON.stringify(parsed_chunk));
      setOutputRaw(chunk);
    }
    
    generate.current = true;
    setLoadingModel(0);
  }

  const handleDataChange = (buttonNum) => {
    setSelectedButton(buttonNum);
  }
  const handleModelChange = (event) => {
    setLoadingModel(1);
    const model_name = event.target.value;

    setModelname(model_name);
    const params = new URLSearchParams();
    params.append('modelname', model_name);
    const url = `http://localhost:8080/loadModel?` + params.toString();
    apiCall(url, 'PUT').then((data) => {
      console.log(data);
    })
    .finally(() => {
      setLoadingModel(0);
    });
  }
      
  const handleInputChange = (event) => {
    const new_input = event.target.value;
    setInput(new_input);
  }

  const handleTokenChange = (event) => {
    const new_tokens = event.target.value;
    setMaxTokens(new_tokens);
  }
  React.useEffect(() => {
  }, []);

  return (
    <Box>
      <Titlebar />
      <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '20px',
          height: '100%',
          border: '1px solid gray'
      }}>
          <Typography textAlign="center">
            RENA helps to extract entities in disease-related news articles along with relations between them. Please verify the output manually before use.
          </Typography>
      </Box>
      <Box sx={{ padding: '20px' }}>
      <Paper elevation={2} sx={{ padding: '30px' }}>
        <Grid container spacing={3}>
      
      <Grid item xs={5}>
        <FormControl fullWidth>
          <TextField
            fullWidth
            multiline
            rows={15}
            variant="outlined"
            value={input}
            placeholder='Input an articles text...'
            onChange={handleInputChange}
          />
        </FormControl>

        <Box sx={{ paddingTop: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <FormControl sx={{ flex: '1.2' }}>
            <InputLabel id="select-model">Select a model</InputLabel>
            <Select
              labelId="select-model"
              id="models"
              value={modelname}
              label="Model name"
              onChange={handleModelChange}
            >
              <MenuItem value={'Yahma'}>Yahma</MenuItem>
              <MenuItem value={'StableBeluga-30'}>StableBeluga-30</MenuItem>
              <MenuItem value={'StableBeluga-135-2'}>StableBeluga-135</MenuItem>
              <MenuItem value={'OpenOrca'}>OpenOrca-Platypus2-13B</MenuItem>
              <MenuItem value={'Mythical'}>Mythical-Destroyer-V2-L2-13B</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ flex: '0.5' }}>
            <Button
              variant="contained"
              color={loadingModel === 0 ? "success" : "error"}
              disabled={loadingModel === 1}
              style={{ opacity: loadingModel === 1 ? 0.5 : 1 }}
              sx={{ height: '55px' }}
              onClick={() => {
                if (loadingModel === 2) {
                  generate.current = false;
                } else {
                  getPrediction();
                }
              }}
            >
              {
                (() => {
                  switch (loadingModel) {
                    case 0: return "Run";
                    case 1: return "Loading model...";
                    case 2: return "Stop";
                    default: return "Run";
                  }
                })()
              }
            </Button>
          </FormControl>
        </Box>

        <Box sx={{ paddingTop: '20px' }}>
          <FormControl fullWidth>
            <Box sx={{ paddingTop: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <FormControl sx={{ flex: '0.4' }}>
              <Typography>
                Words to generate
              </Typography>
            </FormControl>
            <FormControl sx={{ flex: '0.6' }}>
             <TextField
                value={maxTokens}
                onChange={handleTokenChange}
                inputProps={{
                  step: props.step || 1,
                  min: props.min || 1,
                  max: props.max || 2000,
                  style: { height: '5px' },
                  type: 'number',
                  'aria-labelledby': 'input-slider',
                }}
              />
            </FormControl>
              
            </Box>
          
            <Slider
              value={maxTokens}
              onChange={handleTokenChange}
              min={1}
              max={2000}
              aria-labelledby="input-slider"
              {...props}
            />
          </FormControl>
        </Box>
      </Grid>

      <Grid item xs={7}>
        {selectedButton === 0 ? (
          <FormControl fullWidth>
            <TextField
              fullWidth
              multiline
              rows={10}
              placeholder='JSON format'
              variant="outlined"
              value={outputJson}
              readOnly
            />
          </FormControl>
        ) : selectedButton === 1 ? (
          <QuillEditor/>
        ) : (
          <FormControl fullWidth>
            <TextField
              fullWidth
              multiline
              rows={10}
              placeholder='The model will output here...'
              variant="outlined"
              value={outputRaw}
              readOnly
            />
          </FormControl>
        )}
        

        <Box sx={{ paddingTop: '20px', display: 'flex', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>

        <FormControl sx={{ flex: 1 }}>
          <Button
            variant="contained"
            disabled={outputRaw === ''}
            sx={{ height: '45px',  fontWeight: selectedButton === 1 ? 'bold' : 'normal', opacity: selectedButton === 2 ? 1 : 0.5 }}
            onClick={() => {
              handleDataChange(2);
            }}
          >
            RAW
          </Button>
        </FormControl>

        <FormControl sx={{ flex: 1 }}>
          <Button
            variant="contained"
            disabled={outputJson === ''}
            sx={{ height: '45px',  fontWeight: selectedButton === 0 ? 'bold' : 'normal', opacity: selectedButton === 0 ? 1 : 0.5 }}
            onClick={() => {
              handleDataChange(0);
            }}
          >
            JSON
          </Button>
        </FormControl>

        <FormControl sx={{ flex: 1 }}>
          <Button
            variant="contained"
            disabled={outputArticle === ''}
            sx={{ height: '45px',  fontWeight: selectedButton === 1 ? 'bold' : 'normal', opacity: selectedButton === 1 ? 1 : 0.5 }}
            onClick={() => {
              handleDataChange(1);
            }}
          >
            ARTICLE
          </Button>
        </FormControl>
          
        </Box>


      </Grid>
    </Grid>
  </Paper>

  
</Box>
    <Box sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0,
          right: 0,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '47px',
          background: '#3f51b5'
      }}>
          <Typography textAlign="center" variant="body2" style={{ color:'white', fontStyle: 'italic', fontSize: '0.9em' }}>
              RENA was designed and implemented by EPIWATCH.<br />
              EPIWATCH received funding from the Australian Government and Balvi Filantropic Fund.
          </Typography>
      </Box>
  </Box>
    
  )
}

export default Home;
