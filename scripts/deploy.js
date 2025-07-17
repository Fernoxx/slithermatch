const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // USDC addresses
  const USDC_ADDRESSES = {
    // Base mainnet USDC
    8453: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    // Base sepolia USDC  
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  };

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  
  console.log("Deploying to chain ID:", chainId);
  
  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    throw new Error(`USDC address not found for chain ID ${chainId}`);
  }
  
  console.log("Using USDC address:", usdcAddress);

  // Entry fee: $1 USDC (6 decimals) = 1000000
  const entryFee = ethers.parseUnits("1", 6);
  
  const SlitherMatch = await ethers.getContractFactory("SlitherMatch");
  const slitherMatch = await SlitherMatch.deploy(entryFee, usdcAddress);

  await slitherMatch.waitForDeployment();
  const contractAddress = await slitherMatch.getAddress();

  console.log("SlitherMatch deployed to:", contractAddress);
  console.log("Entry fee set to:", entryFee.toString(), "USDC (6 decimals)");
  
  // Verify contract on Basescan
  if (chainId === 8453 || chainId === 84532) {
    console.log("Waiting for block confirmations...");
    await slitherMatch.deploymentTransaction().wait(5);
    
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [entryFee, usdcAddress],
      });
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });