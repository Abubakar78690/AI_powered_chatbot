# Azure Deployment Guide

This guide will help you deploy your AI Chatbot to Microsoft Azure.

## Prerequisites

1. **Azure Account**: Sign up at [portal.azure.com](https://portal.azure.com)
2. **Azure CLI**: Install from [docs.microsoft.com](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Git**: For source control

## Step 1: Deploy Backend to Azure App Service

### 1.1 Login to Azure CLI
```bash
az login
```

### 1.2 Create Resource Group
```bash
az group create --name chatbot-rg --location "East US"
```

### 1.3 Create App Service Plan
```bash
az appservice plan create --name chatbot-backend-plan --resource-group chatbot-rg --sku B1 --is-linux
```

### 1.4 Create Web App
```bash
az webapp create --resource-group chatbot-rg --plan chatbot-backend-plan --name your-chatbot-backend --runtime "NODE|18-lts"
```

### 1.5 Configure Environment Variables
```bash
az webapp config appsettings set --resource-group chatbot-rg --name your-chatbot-backend --settings OPENAI_API_KEY="your-openai-api-key"
```

### 1.6 Deploy Backend Code
```bash
cd backend
az webapp deployment source config-local-git --resource-group chatbot-rg --name your-chatbot-backend
git init
git add .
git commit -m "Initial backend deployment"
git remote add azure <git-url-from-previous-command>
git push azure main
```

## Step 2: Deploy Frontend to Azure Static Web Apps

### 2.1 Create Static Web App
```bash
az staticwebapp create --name your-chatbot-frontend --resource-group chatbot-rg --source https://github.com/yourusername/your-repo --branch main --app-location "/frontend/vite-project" --api-location "/backend"
```

### 2.2 Configure Environment Variables
In Azure Portal:
1. Go to your Static Web App
2. Navigate to Configuration > Application settings
3. Add: `VITE_API_URL=https://your-chatbot-backend.azurewebsites.net`

## Step 3: Alternative - Deploy Both to Azure App Service

### 3.1 Deploy Backend (same as above)

### 3.2 Build Frontend
```bash
cd frontend/vite-project
npm run build
```

### 3.3 Deploy Frontend to App Service
```bash
az webapp create --resource-group chatbot-rg --plan chatbot-backend-plan --name your-chatbot-frontend --runtime "NODE|18-lts"
```

## Environment Variables

### Backend (.env file or Azure App Settings):
```
OPENAI_API_KEY=your-openai-api-key
PORT=3000
```

### Frontend (Azure Static Web App Settings):
```
VITE_API_URL=https://your-backend-url.azurewebsites.net
```

## URLs After Deployment

- **Backend API**: `https://your-chatbot-backend.azurewebsites.net`
- **Frontend**: `https://your-chatbot-frontend.azurestaticapps.net`

## Cost Estimation

- **App Service Plan (B1)**: ~$13/month
- **Static Web Apps**: Free tier available
- **Total**: ~$13-15/month

## Troubleshooting

1. **CORS Issues**: Ensure your backend CORS settings include your frontend domain
2. **Environment Variables**: Double-check all environment variables are set correctly
3. **Build Issues**: Check the build logs in Azure Portal

## Next Steps

1. Set up custom domain (optional)
2. Configure SSL certificates
3. Set up monitoring and logging
4. Configure CI/CD pipeline 