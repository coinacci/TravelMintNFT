import { ethers } from 'ethers';
import fs from 'fs';
import solc from 'solc';
import path from 'path';
import 'dotenv/config';

async function compileContract() {
  const contractPath = 'contracts/TravelNFT.sol';
  const contractSource = fs.readFileSync(contractPath, 'utf8');
  
  // Import OpenZeppelin contracts
  const input = {
    language: 'Solidity',
    sources: {
      'TravelNFT.sol': {
        content: contractSource
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  function findImports(importPath) {
    try {
      if (importPath.startsWith('@openzeppelin/')) {
        const fullPath = path.join('node_modules', importPath);
        return {
          contents: fs.readFileSync(fullPath, 'utf8')
        };
      }
      return { error: 'File not found' };
    } catch (error) {
      return { error: 'File not found' };
    }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  
  if (output.errors) {
    output.errors.forEach(error => {
      console.error(error.formattedMessage);
    });
    if (output.errors.some(error => error.severity === 'error')) {
      throw new Error('Compilation failed');
    }
  }
  
  const contract = output.contracts['TravelNFT.sol']['TravelNFT'];
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  };
}

async function deployContract() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  
  console.log('Compiling contract...');
  const { abi, bytecode } = await compileContract();
  
  console.log('Connecting to Base mainnet...');
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('Deployer address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('ETH balance:', ethers.formatEther(balance));
  
  if (balance < ethers.parseEther('0.0003')) {
    throw new Error('Insufficient ETH balance for deployment (need at least 0.0003 ETH)');
  }
  
  console.log('Deploying TravelNFT contract...');
  const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  // Deploy with deployer as initial owner
  const contract = await contractFactory.deploy(wallet.address, {
    gasLimit: 3000000
  });
  
  console.log('Deployment transaction:', contract.deploymentTransaction().hash);
  console.log('Waiting for deployment confirmation...');
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log('\n=== DEPLOYMENT SUCCESS ===');
  console.log('Network: Base Mainnet (Chain ID: 8453)');
  console.log('Contract Address:', contractAddress);
  console.log('Deployer:', wallet.address);
  console.log('Mint Price: 1 USDC');
  console.log('Transaction:', contract.deploymentTransaction().hash);
  
  // Save contract info for frontend
  const deploymentInfo = {
    contractAddress,
    network: 'base',
    chainId: 8453,
    deploymentDate: new Date().toISOString(),
    deployer: wallet.address,
    transactionHash: contract.deploymentTransaction().hash
  };
  
  fs.writeFileSync('contract-deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('\nDeployment info saved to contract-deployment.json');
  
  return contractAddress;
}

deployContract()
  .then((address) => {
    console.log('\nNow update your frontend with contract address:', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nDeployment failed:', error.message);
    process.exit(1);
  });