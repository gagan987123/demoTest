const { InstantDoc_Function, InstantDoc_Variable } = require('../services/InstantService');
exports.getFunctionDoc = async (req, res) => {
    try {
        const { content, fileType } = req.body;
        console.log('processing functions, fileType: ', fileType);
        const functionDocs = await InstantDoc_Function(content , fileType);
        res.json(functionDocs); 
    } catch (error) {
        console.error('Error fetching function docs:', error);
        res.status(500).json({ error: 'Failed to fetch function documentation' });
    }
};

exports.getVariableDoc = async (req, res) => {
    try {
        const { content, fileType } = req.body;
        console.log('processing variables, fileType: ', fileType);
        const variableDocs = await InstantDoc_Variable(content , fileType);
        res.json(variableDocs); 
    } catch (error) {
        console.error('Error fetching variable docs:', error);
        res.status(500).json({ error: 'Failed to fetch variable documentation' });
    }
    
}