const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SlitherMatch contract...");
  
  // Entry fee: 0.001 ETH (1e15 wei)
  const entryFee = ethers.parseEther("0.001");
  
  const SlitherMatch = await ethers.getContractFactory("SlitherMatch");
  const slitherMatch = await SlitherMatch.deploy(entryFee);

  await slitherMatch.waitForDeployment();
  
  const contractAddress = await slitherMatch.getAddress();
  console.log("SlitherMatch deployed to:", contractAddress);
  console.log("Entry fee set to:", ethers.formatEther(entryFee), "ETH");
  
  // Verify deployment
  console.log("Verifying deployment...");
  const deployedEntryFee = await slitherMatch.entryFee();
  const owner = await slitherMatch.owner();
  
  console.log("Contract owner:", owner);
  console.log("Entry fee:", ethers.formatEther(deployedEntryFee), "ETH");
  
  console.log("\n🎉 Deployment successful!");
  console.log("Add this address to your frontend:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});