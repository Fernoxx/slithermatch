// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SlitherMatch {
    uint256 public lobbyCounter;
    uint256 public entryFee;
    address public owner;

    enum LobbyState { Waiting, Active, Completed, Refundable }

    struct Player {
        address wallet;
        uint256 score;
        bool alive;
        uint256 joinedAt;
    }

    struct Lobby {
        uint256 id;
        address[] players;
        mapping(address => Player) playerData;
        uint256 createdAt;
        uint256 startedAt;
        LobbyState state;
        address winner;
        uint256 totalPot;
    }

    mapping(uint256 => Lobby) private lobbies;
    mapping(address => uint256) public playerCurrentLobby;

    event LobbyCreated(uint256 indexed lobbyId);
    event PlayerJoined(uint256 indexed lobbyId, address indexed player);
    event LobbyActivated(uint256 indexed lobbyId, uint256 startTime);
    event GameEnded(uint256 indexed lobbyId, address indexed winner, uint256 payout);
    event RefundIssued(uint256 indexed lobbyId, address indexed player, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(uint256 _entryFee) {
        owner = msg.sender;
        entryFee = _entryFee; // 0.001 ETH = 1e15 wei
        lobbyCounter = 0;
    }

    function createLobby() internal returns (uint256) {
        lobbyCounter++;
        Lobby storage lobby = lobbies[lobbyCounter];
        lobby.id = lobbyCounter;
        lobby.createdAt = block.timestamp;
        lobby.state = LobbyState.Waiting;
        lobby.totalPot = 0;
        emit LobbyCreated(lobbyCounter);
        return lobbyCounter;
    }

    function joinLobby(uint256 _lobbyId) external payable {
        require(msg.value == entryFee, "Incorrect entry fee");
        require(playerCurrentLobby[msg.sender] == 0, "Already in a lobby");
        
        // Create lobby if it doesn't exist
        if (_lobbyId == 0 || lobbies[_lobbyId].id == 0) {
            _lobbyId = createLobby();
        }
        
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.state == LobbyState.Waiting, "Lobby not available");
        require(lobby.players.length < 5, "Lobby is full");
        
        // Check if player already joined
        for (uint i = 0; i < lobby.players.length; i++) {
            require(lobby.players[i] != msg.sender, "Already joined this lobby");
        }

        lobby.players.push(msg.sender);
        lobby.playerData[msg.sender] = Player(msg.sender, 0, true, block.timestamp);
        lobby.totalPot += msg.value;
        playerCurrentLobby[msg.sender] = _lobbyId;

        emit PlayerJoined(_lobbyId, msg.sender);

        // Auto-start when 3 players join
        if (lobby.players.length == 3) {
            lobby.state = LobbyState.Active;
            lobby.startedAt = block.timestamp;
            emit LobbyActivated(_lobbyId, block.timestamp);
        }
    }

    function markGameStarted(uint256 _lobbyId) external onlyOwner {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.state == LobbyState.Waiting, "Game already started or ended");
        require(lobby.players.length >= 3, "Need at least 3 players");
        
        lobby.state = LobbyState.Active;
        lobby.startedAt = block.timestamp;
        emit LobbyActivated(_lobbyId, block.timestamp);
    }

    function declareWinner(uint256 _lobbyId, address _winner) external onlyOwner {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.state == LobbyState.Active, "Game not active");
        require(lobby.playerData[_winner].wallet == _winner, "Winner not in lobby");

        lobby.state = LobbyState.Completed;
        lobby.winner = _winner;

        // Pay out winner
        uint256 payout = lobby.totalPot;
        payable(_winner).transfer(payout);

        // Clear player lobby assignments
        for (uint i = 0; i < lobby.players.length; i++) {
            playerCurrentLobby[lobby.players[i]] = 0;
        }

        emit GameEnded(_lobbyId, _winner, payout);
    }

    function markRefundable(uint256 _lobbyId) external {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.state == LobbyState.Waiting, "Lobby already active or ended");
        require(block.timestamp > lobby.createdAt + 5 minutes, "Lobby still within wait time");
        lobby.state = LobbyState.Refundable;
    }

    function refundIfUnstarted(uint256 _lobbyId, address _player) external {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.state == LobbyState.Refundable, "Refunds not enabled");
        require(msg.sender == _player, "Can only refund own entry");

        Player storage player = lobby.playerData[_player];
        require(player.wallet == _player, "Not part of lobby");
        require(player.wallet != address(0), "Already refunded");

        player.wallet = address(0); // prevent double refund
        playerCurrentLobby[_player] = 0;
        payable(_player).transfer(entryFee);
        
        emit RefundIssued(_lobbyId, _player, entryFee);
    }

    function getPlayers(uint256 _lobbyId) external view returns (address[] memory) {
        return lobbies[_lobbyId].players;
    }

    function getLobbyState(uint256 _lobbyId) external view returns (LobbyState) {
        return lobbies[_lobbyId].state;
    }

    function getLobbyInfo(uint256 _lobbyId) external view returns (
        uint256 id,
        address[] memory players,
        uint256 createdAt,
        uint256 startedAt,
        LobbyState state,
        address winner,
        uint256 totalPot
    ) {
        Lobby storage lobby = lobbies[_lobbyId];
        return (
            lobby.id,
            lobby.players,
            lobby.createdAt,
            lobby.startedAt,
            lobby.state,
            lobby.winner,
            lobby.totalPot
        );
    }

    function getCurrentLobby() external view returns (uint256) {
        return playerCurrentLobby[msg.sender];
    }

    function getActiveLobby() external view returns (uint256) {
        // Find the latest active lobby
        for (uint256 i = lobbyCounter; i > 0; i--) {
            if (lobbies[i].state == LobbyState.Waiting && lobbies[i].players.length < 5) {
                return i;
            }
        }
        return 0; // No active lobby found
    }

    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function updateEntryFee(uint256 _newFee) external onlyOwner {
        entryFee = _newFee;
    }
}