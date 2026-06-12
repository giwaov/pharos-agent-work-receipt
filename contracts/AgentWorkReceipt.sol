// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentWorkReceipt
/// @notice Pays an AI agent for completed work and emits an on-chain receipt.
contract AgentWorkReceipt {
    uint256 public receiptCount;

    event AgentWorkPaid(
        bytes32 indexed receiptId,
        address indexed caller,
        address indexed provider,
        string skill,
        uint256 amountWei,
        bytes32 inputHash,
        bytes32 outputHash,
        string metadataURI
    );

    error InvalidProvider();
    error NoPayment();
    error PaymentFailed();

    function payForWork(
        address provider,
        string calldata skill,
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata metadataURI
    ) external payable returns (bytes32 receiptId) {
        if (provider == address(0)) revert InvalidProvider();
        if (msg.value == 0) revert NoPayment();

        receiptCount += 1;
        receiptId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                receiptCount,
                msg.sender,
                provider,
                skill,
                msg.value,
                inputHash,
                outputHash,
                metadataURI
            )
        );

        (bool sent,) = payable(provider).call{value: msg.value}("");
        if (!sent) revert PaymentFailed();

        emit AgentWorkPaid(
            receiptId,
            msg.sender,
            provider,
            skill,
            msg.value,
            inputHash,
            outputHash,
            metadataURI
        );
    }
}
