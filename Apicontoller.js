
const defaultBranch = "main";
const ASTModel = require("../modals/AST");
const {generateMarkdown,generateMarkdownforVariable} = require("../services/mcpWrapper");
const RepositoryModel = require("../modals/Repository");
const markdownModal = require("../modals/Markdown");

const redisClient = require("../services/redisclient");
exports.registerRepository = async (req, res) => {
  try {
    const { owner, repo, pat } = req.body;
    console.log(owner, repo, pat);
    let response;
    const headers = pat ? { Authorization: `Bearer ${pat}` } : {};
    response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    );
   
     
    const repoData = await response.json();
    if (!repoData) {
      return res.status(404).json({ message: "Repository not found" });
    }
    
    const repositoryInfo = {
      name: repoData.name,
      owner: repoData.owner.login,
      fullName: repoData.full_name,
      description: repoData.description || '',
      private: repoData.private,
      defaultBranch: repoData.default_branch,
      userId: req.user.userId,
      stats: {
        size: repoData.size,
        stargazers: repoData.stargazers_count,
        watchers: repoData.watchers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        subscribers: repoData.subscribers_count
      },
      pat: pat
    };

    const newRepository = new RepositoryModel(repositoryInfo);
    await newRepository.save();

    res.json(newRepository);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.listAllFiles = async (req, res) => {
  try {
    const { owner, repo, pat,ghsfghsdfjhdfwsghfdhsdfghggfdgf} = req.body;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
        },
      }
    );
    const data = await response.json();

    if (!data) {
      return res.status(404).json({ message: "Repository not found" });
    }
    console.log(data);
    res.json({
      status: "success",
      files: data.tree.map(file => file.path),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getAllRepos = async (req, res) => {
  try {
    const { userId } = req.user;
    const cacheKey = `user:${userId}:repos`;
    
    // Try to get from cache first
    const cachedRepos = await redisClient.get(cacheKey);
    if (cachedRepos) {
      return res.json({
        status: "success",
        repositories: cachedRepos,
        fromCache: true
      });
    }

    // If not in cache, fetch from database
    const repositories = await RepositoryModel.find({ userId });
    const formattedRepos = repositories.map(repo => ({
      id: repo._id,
      name: repo.name,
      owner: repo.owner,
      fullName: repo.fullName,
      description: repo.description,
      private: repo.private,
      stars: repo.stats?.stargazers || 0,
      forks: repo.stats?.forks || 0,
      issues: repo.stats?.openIssues || 0,
      updated: repo.updatedAt?.toLocaleString() || new Date().toLocaleString(),
      defaultBranch: repo.defaultBranch || 'main',
      pat: repo.pat ? '*****' : undefined // Mask sensitive data
    }));

    // Cache for 5 minutes (300 seconds)
    await redisClient.set(cacheKey, formattedRepos, 300);

    res.json({
      status: "success",
      repositories: formattedRepos,
      fromCache: false
    });
  } catch (error) {
    console.error('Error in getAllRepos:', error);
    res.status(500).json({ 
      status: "error",
      message: "Failed to fetch repositories"
    });
  }
};
exports.deleteRepo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    
    await RepositoryModel.findOneAndDelete({ _id: id, userId });
    
    await redisClient.delete(`user:${userId}:repos`);
    
    res.json({ status: "success", message: "Repository deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRepoById = async (req,res) => {
  try {
    const { id } = req.params;
    const repository = await RepositoryModel.findById(id).select("userId").select("pat").select("fullName");
    if(repository.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "You don't have permission to access this repository" });
    }
    res.json({
      status: "success",
      repository,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


exports.getFiledoc = async (req, res) => {
    try {
        let { owner, repo, filePath } = req.params;
        
        // Decode the filePath to handle URL-encoded characters
        filePath = decodeURIComponent(filePath);
        const userId = req.user.userId;
        
        // Create a unique cache key
        const cacheKey = `doc:${userId}:${owner}:${repo}:${filePath}`;
        
        // Try to get from cache first
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json({
                status: 'success',
                data: cachedData,
                fromCache: true
            });
        }
        const content = await markdownModal.findOne({ 
          userId,
          filePath,
          'repoInfo.owner': owner,
          'repoInfo.repo': repo,
           
        })
        await redisClient.set(cacheKey, content, 120);
        if (!content) {
            return res.status(404).json({ 
                status: 'error',
                message: 'File not found' 
            });
        }
        
        res.json({
            status: 'success',
            data: content
        });
    } catch (error) {
      console.log(error);
        res.status(500).json({ 
          
            status: 'error',
            message: 'Failed to fetch file content',
           
        });
    }
};

exports.refreshdoc = async (req, res) => {
  try {
    let { functionName, owner, repo, path } = req.params;
    const { code } = req.body;
    
    console.log(functionName, owner, repo, path ,code );
    // Decode the filePath to handle URL-encoded characters
    path = decodeURIComponent(path);
 
    
    const userId = req.user.userId;
    const redisKey = `doc:${userId}:${owner}:${repo}:${path}`;
    
    // Generate new markdown content
    await new Promise(resolve => setTimeout(resolve, 5000));
    let content;
    if(functionName == "variables"){
       console.log("variable")
      content = await generateMarkdownforVariable(code);
    }
    else{
      console.log("function")
      content = await generateMarkdown(code);
    }
    
    // Find the document
    const doc = await markdownModal.findOne({
      userId,
      filePath: path,
      'repoInfo.owner': owner,
      'repoInfo.repo': repo
    });

    if (!doc) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Document not found' 
      });
    }

    // Check if functions is a Map
    if (!(doc.functions instanceof Map)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid document structure: functions is not a Map' 
      });
    }

    // Check if function exists
    if (!doc.functions.has(functionName)) {
      return res.status(404).json({ 
        status: 'error',
        message: `Function "${functionName}" not found in document` 
      });
    }

    // Update the function
    doc.functions.set(functionName, { 
      functionName, 
      markdownContent: content,
      code,
      updatedAt: new Date()
    });
    
    doc.lastUpdated = new Date();
    
    // Save the updated document
    await doc.save();
    
    // Invalidate Redis cache
    try {
      await redisClient.delete(redisKey);
    } catch (cacheError) {
      console.error('Error invalidating cache:', cacheError);
      // Continue even if cache invalidation fails
    }
    return res.status(200).json({ 
      status: 'success',
      data: {
        function: {
          functionName,
          markdownContent: content,
          code: code,
          updatedAt: new Date()
        },
        lastUpdated: doc.lastUpdated
      }
    });
      
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to refresh documentation',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.deleteRepo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    
    const repo = await RepositoryModel.findOne({ _id: id, userId });
    if (!repo) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Repository not found or not authorized' 
      });
    }

    await markdownModal.deleteMany({ 
      userId,
      'repoInfo.owner': repo.owner,
      'repoInfo.repo': repo.name
    });

    await ASTModel.deleteMany({
      userId,
      'repoInfo.owner': repo.owner,
      'repoInfo.repo': repo.name
    });

    await RepositoryModel.deleteOne({ _id: id, userId });

    try {
      if (redisClient && typeof redisClient.del === 'function') {
        await redisClient.delete(`user:${userId}:repos`);
        const pattern = `ast:${userId}:${repo.owner}:${repo.name}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.delete(keys);
        }
      }
    } catch (cacheError) {
      console.error('Error clearing cache:', cacheError);
    }

    res.json({ 
      status: 'success', 
      message: 'Repository and all related data deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to delete repository',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
