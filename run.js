const { ethers } = require("ethers");
require("dotenv").config();
const colors = require('colors');

console.log(colors.yellow.bold(`
 █████╗ ██████╗ ███████╗███╗   ██╗ █████╗ ███████╗
██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔════╝
███████║██████╔╝█████╗  ██╔██╗ ██║███████║███████╗
██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║╚════██║
██║  ██║██║  ██║███████╗██║ ╚████║██║  ██║███████║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
`.bold));
console.log(colors.cyan.bold("arenas.fi | bactiar291\n"));

const TOKENS = {
  WETH: {
    address: "0xdd8f41bf80d0E47132423339ca06bC6413da96b5",
    decimals: 18,
    mintAmount: 10,
    initialSupplyPercent: 50,
    borrowPercent: 50,
    withdrawPercent: 10
  },
  WBTC: {
    address: "0xE3233Ee6E373Be04277a435facc262E7A9c46151",
    decimals: 8,
    mintAmount: 1,
    initialSupplyPercent: 50,
    borrowPercent: 50,
    withdrawPercent: 10
  },
  USDC: {
    address: "0x833A00575F39037403006A822C3fd7AD9abFF32C",
    decimals: 6,
    mintAmount: 10000,
    initialSupplyPercent: 50,
    borrowPercent: 50,
    withdrawPercent: 10
  },
  USDT: {
    address: "0xAe5b5C30003ef1F8eAE9E00e79c6CCa7D48E6e8A",
    decimals: 6,
    mintAmount: 10000,
    initialSupplyPercent: 50,
    borrowPercent: 50,
    withdrawPercent: 10
  }
};

const config = {
  rpcUrl: process.env.RPC_URL,
  chainId: Number(process.env.CHAIN_ID),
  faucetAddress: process.env.FAUCET_ADDRESS,
  arenaSomniaAddress: "0xa22b4C1F7C4e6946982f55DC15c723c604324A97",
  gasPrice: ethers.parseUnits("6", "gwei"),
  borrowRepayDelay: 30000
};

const FAUCET_ABI = [
  "function mint(address token, address to, uint256 amount)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

const ARENA_SOMNIA_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)",
  "function withdraw(address asset, uint256 amount, address to)"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleApprove(tokenContract, token, spenderAddress, wallet) {
  const currentAllowance = await tokenContract.allowance(
    wallet.address,
    spenderAddress
  );
  
  const decimals = token.decimals;
  
  if (currentAllowance > ethers.parseUnits("1000000", decimals)) {
    console.log(colors.green(`✅ Allowance already sufficient: ${ethers.formatUnits(currentAllowance, decimals)}`));
    return { approved: true, hash: null };
  }

  const maxAmount = ethers.MaxUint256;
  
  try {
    const tx = await tokenContract.approve(
      spenderAddress,
      maxAmount,
      {
        gasPrice: config.gasPrice,
        type: 0
      }
    );

    console.log(colors.yellow(`! Approval sent: ${tx.hash}`));
    const receipt = await tx.wait();
    console.log(colors.green(`✅ Approval confirmed in block ${receipt.blockNumber}`));
    
    return { approved: true, hash: tx.hash };
  } catch (error) {
    console.error(colors.red(`❌ Approval failed: ${error.message}`));
    return { approved: false, error };
  }
}

async function handleSupply(arenaSomniaContract, token, amount, wallet) {
  try {
    const tx = await arenaSomniaContract.supply(
      token.address,
      amount,
      wallet.address,
      0,
      {
        gasPrice: config.gasPrice,
        type: 0
      }
    );

    console.log(colors.yellow(`! Supply sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    const feeInWei = gasUsed * config.gasPrice;
    const feeInEther = ethers.formatEther(feeInWei);
    
    console.log(colors.green.bold(`✅ SUPPLY SUCCESS! ${ethers.formatUnits(amount, token.decimals)} ${token.symbol}`));
    console.log(`Block: ${receipt.blockNumber} | Gas used: ${gasUsed.toString()} | Fee: ${feeInEther} STT`);
    
    return { success: true, hash: tx.hash, amount: amount };
  } catch (error) {
    console.error(colors.red.bold(`❌ SUPPLY FAILED: ${error.message}`));
    return { success: false, error };
  }
}

async function handleBorrow(arenaSomniaContract, token, amount, wallet) {
  const interestRateMode = 2; 
  
  try {
    let estimatedGas;
    try {
      estimatedGas = await arenaSomniaContract.borrow.estimateGas(
        token.address,
        amount,
        interestRateMode,
        0,
        wallet.address
      );
    } catch (error) {
      console.error("Borrow gas estimation failed, using default:", error);
      estimatedGas = 500000n;
    }
    
    const gasLimit = estimatedGas * 120n / 100n;

    const tx = await arenaSomniaContract.borrow(
      token.address,
      amount,
      interestRateMode,
      0,
      wallet.address,
      {
        gasPrice: config.gasPrice,
        gasLimit: gasLimit,
        type: 0
      }
    );

    console.log(colors.yellow(`! Borrow sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    const feeInWei = gasUsed * config.gasPrice;
    const feeInEther = ethers.formatEther(feeInWei);
    
    console.log(colors.green.bold(`✅ BORROW SUCCESS! ${ethers.formatUnits(amount, token.decimals)} ${token.symbol}`));
    console.log(`Block: ${receipt.blockNumber} | Gas used: ${gasUsed.toString()} | Fee: ${feeInEther} STT`);
    
    return { success: true, hash: tx.hash };
  } catch (error) {
    console.error(colors.red.bold(`❌ BORROW FAILED: ${error.message}`));
    return { success: false, error };
  }
}

async function handleRepay(arenaSomniaContract, token, wallet) {
  const interestRateMode = 2; 
  const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  
  try {
    const amount = ethers.MaxUint256;
    
    const approveResult = await handleApprove(
      tokenContract,
      token,
      config.arenaSomniaAddress,
      wallet
    );
    
    if (!approveResult.approved) {
      console.log(colors.red(`❌ Skipping repay due to approval failure`));
      return { success: false, error: "Approval failed" };
    }
    
    await delay(5000);

    let estimatedGas;
    try {
      estimatedGas = await arenaSomniaContract.repay.estimateGas(
        token.address,
        amount,
        interestRateMode,
        wallet.address
      );
    } catch (error) {
      console.error("Repay gas estimation failed, using default:", error);
      estimatedGas = 300000n;
    }
    
    const gasLimit = estimatedGas * 120n / 100n;

    const tx = await arenaSomniaContract.repay(
      token.address,
      amount,
      interestRateMode,
      wallet.address,
      {
        gasPrice: config.gasPrice,
        gasLimit: gasLimit,
        type: 0
      }
    );

    console.log(colors.yellow(`! Repay sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    const feeInWei = gasUsed * config.gasPrice;
    const feeInEther = ethers.formatEther(feeInWei);
    
    console.log(colors.green.bold(`✅ REPAY SUCCESS! ${token.symbol}`));
    console.log(`Block: ${receipt.blockNumber} | Gas used: ${gasUsed.toString()} | Fee: ${feeInEther} STT`);
    
    return { success: true, hash: tx.hash };
  } catch (error) {
    console.error(colors.red.bold(`❌ REPAY FAILED: ${error.message}`));
    return { success: false, error };
  }
}

async function handleWithdraw(arenaSomniaContract, token, amount, wallet) {
  try {
    let estimatedGas;
    try {
      estimatedGas = await arenaSomniaContract.withdraw.estimateGas(
        token.address,
        amount,
        wallet.address
      );
    } catch (error) {
      console.error("Withdraw gas estimation failed, using default:", error);
      estimatedGas = 200000n;
    }
    
    const gasLimit = estimatedGas * 120n / 100n;

    const tx = await arenaSomniaContract.withdraw(
      token.address,
      amount,
      wallet.address,
      {
        gasPrice: config.gasPrice,
        gasLimit: gasLimit,
        type: 0
      }
    );

    console.log(colors.yellow(`! Withdraw sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    const feeInWei = gasUsed * config.gasPrice;
    const feeInEther = ethers.formatEther(feeInWei);
    
    console.log(colors.green.bold(`✅ WITHDRAW SUCCESS! ${ethers.formatUnits(amount, token.decimals)} ${token.symbol}`));
    console.log(`Block: ${receipt.blockNumber} | Gas used: ${gasUsed.toString()} | Fee: ${feeInEther} STT`);
    
    return { success: true, hash: tx.hash };
  } catch (error) {
    console.error(colors.red.bold(`❌ WITHDRAW FAILED: ${error.message}`));
    return { success: false, error };
  }
}

async function mintToken(faucetContract, token, wallet) {
  const amount = ethers.parseUnits(token.mintAmount.toString(), token.decimals);
  
  console.log(colors.cyan(`\n>> MINTING ${token.mintAmount} ${token.symbol}...`));
  console.log(`Token: ${token.address}`);
  console.log(`Amount: ${token.mintAmount} (${amount.toString()} wei)`);

  let gasLimit;
  try {
    const estimatedGas = await faucetContract.mint.estimateGas(
      token.address,
      wallet.address,
      amount
    );
    
    const baseBuffer = 10000n;
    const bufferPercentage = 10n;
    const calculatedBuffer = estimatedGas * bufferPercentage / 100n;
    const buffer = calculatedBuffer > baseBuffer ? calculatedBuffer : baseBuffer;
    
    gasLimit = estimatedGas + buffer;
    
    console.log(`Estimated gas: ${estimatedGas.toString()}`);
    console.log(`Gas buffer: ${buffer.toString()}`);
    console.log(`Final gas limit: ${gasLimit.toString()}`);
  } catch (estimateError) {
    console.error("Gas estimation failed, using default:", estimateError);
    gasLimit = 70033n;
  }

  try {
    const tx = await faucetContract.mint(
      token.address,
      wallet.address,
      amount,
      {
        gasPrice: config.gasPrice,
        gasLimit: gasLimit,
        type: 0
      }
    );

    console.log(colors.yellow(`! Transaction sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed;
    const feeInWei = gasUsed * config.gasPrice;
    const feeInEther = ethers.formatEther(feeInWei);
    
    console.log(colors.green.bold(`✅ MINT SUCCESS! ${token.symbol}`));
    console.log(`Block: ${receipt.blockNumber} | Gas used: ${gasUsed.toString()} | Fee: ${feeInEther} STT`);
    
    return { success: true, hash: tx.hash, amount: amount };
  } catch (error) {
    console.error(colors.red.bold(`\n❌ ${token.symbol} MINT FAILED`));
    
    if (error.reason) console.error("Reason:", error.reason);
    if (error.code === "INSUFFICIENT_FUNDS") console.error("Error: Insufficient gas balance");
    else if (error.code === "CALL_EXCEPTION") console.error("Error: Contract call exception");
    else console.error("Full error:", error);
    
    return { success: false, error: error.message };
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(colors.yellow(`\n=======================================`));
  console.log(colors.yellow.bold(`Somnia Network Bot | bactiar291`));
  console.log(colors.yellow(`=======================================`));
  console.log(`Connected wallet: ${wallet.address}`);
  console.log(`Network chain ID: ${(await provider.getNetwork()).chainId}`);
  console.log(`Gas price: ${ethers.formatUnits(config.gasPrice, 'gwei')} gwei`);
  
  const faucetContract = new ethers.Contract(
    config.faucetAddress,
    FAUCET_ABI,
    wallet
  );
  
  const arenaSomniaContract = new ethers.Contract(
    config.arenaSomniaAddress,
    ARENA_SOMNIA_ABI,
    wallet
  );

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let sessionCount = 1;
  await new Promise(resolve => {
    readline.question(colors.cyan.bold('! ENTER NUMBER OF SESSIONS: '), answer => {
      sessionCount = parseInt(answer) || 1;
      readline.close();
      resolve();
    });
  });

  for (let session = 1; session <= sessionCount; session++) {
    console.log(colors.magenta.bold(`\n===== [SESSION ${session}/${sessionCount}] STARTING =====`));
    
    for (const [symbol, token] of Object.entries(TOKENS)) {
      token.symbol = symbol;
      
      console.log(colors.cyan.bold(`\n--- PROCESSING ${symbol} ---`));
      
      const mintResult = await mintToken(faucetContract, token, wallet);
      if (!mintResult.success) {
        console.log(colors.red(`❌ Skipping ${symbol} due to mint failure`));
        continue;
      }
      await delay(3000);
      
      const tokenContract = new ethers.Contract(
        token.address,
        ERC20_ABI,
        wallet
      );
      
      const approveResult = await handleApprove(
        tokenContract,
        token,
        config.arenaSomniaAddress,
        wallet
      );
      
      if (!approveResult.approved) {
        console.log(colors.red(`❌ Skipping ${symbol} due to approval failure`));
        continue;
      }
      await delay(3000);
      
      const tokenBalance = await tokenContract.balanceOf(wallet.address);
      const supplyAmount = tokenBalance * BigInt(token.initialSupplyPercent) / 100n;
      
      const supplyResult = await handleSupply(
        arenaSomniaContract,
        token,
        supplyAmount,
        wallet
      );
      
      if (!supplyResult.success) {
        console.log(colors.red(`⚠️ Continuing despite supply failure`));
      }
      await delay(3000);
      
      const borrowAmount = supplyAmount * BigInt(token.borrowPercent) / 100n;
      const borrowResult = await handleBorrow(
        arenaSomniaContract,
        token,
        borrowAmount,
        wallet
      );
      
      if (!borrowResult.success) {
        console.log(colors.red(`⚠️ Continuing despite borrow failure`));
      }
      
      console.log(colors.yellow(`\n! WAITING ${config.borrowRepayDelay/1000} SECONDS BEFORE REPAY...`));
      await delay(config.borrowRepayDelay);
      
      const repayResult = await handleRepay(arenaSomniaContract, token, wallet);
      if (!repayResult.success) {
        console.log(colors.red(`⚠️ Continuing despite repay failure`));
      }
      await delay(3000);
      
      const withdrawAmount = supplyAmount * BigInt(token.withdrawPercent) / 100n;
      const withdrawResult = await handleWithdraw(
        arenaSomniaContract,
        token,
        withdrawAmount,
        wallet
      );
      
      if (!withdrawResult.success) {
        console.log(colors.red(`⚠️ Continuing despite withdraw failure`));
      }
      
      console.log(colors.green.bold(`\n✅ ${symbol} COMPLETED!`));
      await delay(5000);
    }
    
    console.log(colors.magenta.bold(`\n===== [SESSION ${session}/${sessionCount}] COMPLETED =====`));
  }
  
  console.log(colors.yellow(`\n=======================================`));
  console.log(colors.green.bold("ALL OPERATIONS COMPLETED SUCCESSFULLY!"));
  console.log(colors.cyan.bold("arenas.fi | bactiar291"));
  console.log(colors.yellow(`=======================================\n`));
}

main().catch(console.error);
