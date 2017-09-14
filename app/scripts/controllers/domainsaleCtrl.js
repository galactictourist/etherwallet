'use strict';
var domainsaleCtrl = function($scope, $sce, walletService) {
    $scope.referrer = "0x388Ea662EF2c223eC0B047D41Bf3c0f362142ad5";
    $scope.ajaxReq = ajaxReq;
    $scope.hideDomainSaleInfoPanel = false;
    walletService.wallet = null;
    $scope.domainsaleConfirmModalModal = new Modal(document.getElementById('domainsaleConfirmModal'));
    $scope.Validator = Validator;
    $scope.wd = false;
    $scope.haveNotAlreadyCheckedLength = true;
    var ENS = new ens();
    var DomainSale = new domainsale();
    $scope.ensModes = ens.modes;
    $scope.domainsaleModes = domainsale.modes;
    $scope.domainsaleTransactions = domainsale.transactions;
    $scope.minNameLength = 7;
    $scope.objDomainSale = {
        name: '',
        nameReadOnly: false,
    };
    $scope.objENS = {
        status: -1,
        name: '',
        price: 0,
        priceEth: 0,
        reserve: 0,
        reserveEth: 0,
        bid: 0,
        bidEth: 0,

        namehash: '',
        nameSHA3: '',
        resolvedAddress: null,
        revealObject: null,
        timer: null,
        timeRemaining: null,
        timeRemainingReveal: null,
        txSent: false
    };
    $scope.gasLimitDefaults = {
        // TODO set sensible values
        transfer: '200000',
        offer: '200000',
        bid: '200000',
        buy: '200000',
        cancel: '200000',
        withdraw: '200000'
    }
    $scope.tx = {
        gasLimit: '500000',
        data: '',
        to: '',
        unit: "ether",
        value: 0,
        gasPrice: null
    };
    $scope.showDomainSale = function() {
        return nodes.domainsaleNodeTypes.indexOf(ajaxReq.type) > -1;
    }
    $scope.$watch(function() {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function() {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
        $scope.wd = true;
        $scope.objENS.nameReadOnly = true;
        $scope.wallet.setBalance();
        $scope.wallet.setTokens();
    });
    $scope.getCurrentTime = function() {
        return new Date().toString();
    }
    var updateScope = function() {
        if (!$scope.$$phase) $scope.$apply();
    }
    var timeRem = function(timeUntil) {
        var rem = timeUntil - new Date();
        if (rem < 0) {
            clearInterval($scope.objENS.timer);
            $scope.objENS.timeRemaining = "EXPIRED";
            return
        }
        var _second = 1000;
        var _minute = _second * 60;
        var _hour = _minute * 60;
        var _day = _hour * 24;
        var days = Math.floor(rem / _day);
        var hours = Math.floor((rem % _day) / _hour);
        var minutes = Math.floor((rem % _hour) / _minute);
        var seconds = Math.floor((rem % _minute) / _second);
        days = days < 10 ? '0' + days : days;
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        $scope.objENS.timeRemaining = days + ' days ' + hours + ' hours ' + minutes + ' minutes ' + seconds + ' seconds ';
        $scope.objENS.timeRemainingReveal = (days - 2) + ' days ' + hours + ' hours ' + minutes + ' minutes ' + seconds + ' seconds ';
        updateScope();
    }
    $scope.nameOnChange = function() {
        // Resets information
        $scope.objDomainSale.status = -1;
        $scope.objDomainSale.bid = 0;
        $scope.objDomainSale.bidEth = 0;
        $scope.objDomainSale.buy = 0;
        $scope.objDomainSale.buyEth = 0;
        $scope.objDomainSale.reserve = 0;
        $scope.objDomainSale.reserveEth = 0;
        $scope.objDomainSale.timeRemaining = null;
        clearInterval($scope.objDomainSale.timer);
    }
    $scope.checkName = function() {
        // checks if it's the same length as a PK and if so, warns them.
        // If they confirm they can set haveNotAlreadyCheckedLength to true and carry on
        if ($scope.haveNotAlreadyCheckedLength && ($scope.objDomainSale.name.length == 128 || $scope.objDomainSale.name.length == 132 || $scope.objDomainSale.name.length == 64 || $scope.objDomainSale.name.length == 66)) {
            $scope.notifier.danger("That looks an awful lot like a private key. Are you sure you would like to check if this name is available on the ENS network? If so, click `Check`. If it is your private key, click refresh & try again.");
            $scope.haveNotAlreadyCheckedLength = false;
        } else if ($scope.Validator.isValidENSName($scope.objDomainSale.name) && $scope.objDomainSale.name.indexOf('.') == -1) {
            $scope.objDomainSale.name = ens.normalise($scope.objDomainSale.name);
            $scope.objDomainSale.namehash = ens.getNameHash($scope.objDomainSale.name + '.eth');
            $scope.objDomainSale.nameSHA3 = ENS.getSHA3($scope.objDomainSale.name);
            $scope.hideDomainSaleInfoPanel = true;
            ENS.getAuctionEntries($scope.objDomainSale.name, function(data) {
                if (data.error) $scope.notifier.danger(data.msg);
                else {
                    var entries = data.data;
                    for (var key in entries) if (key != 'status') $scope.objDomainSale[key] = entries[key];
                    if (data.data.status != $scope.ensModes.owned) {
                        // Not owned so ineligible for domainsale
                        $scope.objDomainSale.status = $scope.domainsaleModes.ineligible;
                        updateScope();
                    } else {
                        ENS.getDeedOwner($scope.objDomainSale.deed, function(data) {
                            $scope.objDomainSale.deedOwner = data.data;
                            if (data.data.toLowerCase() != DomainSale.getContractAddress().toLowerCase()) {
                                // Not owned by DomainSale contract
                                $scope.objDomainSale.status = $scope.domainsaleModes.nottransferred;
                                updateScope();
                            } else {
                                DomainSale.getSale($scope.objDomainSale.name, function(data) {
                                    var entries = data.data;
                                    for (var key in entries) $scope.objDomainSale[key] = entries[key];
                                    if ($scope.objDomainSale.price == 0 && $scope.objDomainSale.reserve == 0) {
                                        // Not yet offered for sale
                                        $scope.objDomainSale.status = $scope.domainsaleModes.notoffered;
                                    } else if ($scope.objDomainSale.auctionStarted.getTime() == 0) {
                                        // Available for sale
                                        $scope.objDomainSale.status = $scope.domainsaleModes.available;
                                        $scope.objDomainSale.minimumBid = $scope.objDomainSale.reserve;
                                        $scope.objDomainSale.minimumBidEth = $scope.objDomainSale.reserveEth;
                                        $scope.objDomainSale.bid = $scope.objDomainSale.minimumBid;
                                        $scope.objDomainSale.bidEth = $scope.objDomainSale.minimumBidEth;
                                    } else if ($scope.objDomainSale.auctionEnds.getTime() >= new Date().getTime()) {
                                        // Being auctioned
                                        $scope.objDomainSale.status = $scope.domainsaleModes.auctioning;
                                        DomainSale.getMinimumBid($scope.objDomainSale.name, function(data) {
                                            for (var key in entries) $scope.objDomainSale[key] = entries[key];
                                            $scope.objDomainSale.bid = $scope.objDomainSale.minimumBid;
                                            $scope.objDomainSale.bidEth = $scope.objDomainSale.minimumBidEth;
                                            updateScope();
                                        });
                                    } else {
                                        // Auction finished
                                        $scope.objDomainSale.status = $scope.domainsaleModes.finished;
                                    }
                                    updateScope();
                                });
                            }
                        });
                    }
                }
            })
        } else $scope.notifier.danger(globalFuncs.errorMsgs[30]);
    }

    // Sync internal values with inputs
    $scope.syncPrice = function() {
        if ($scope.objDomainSale.priceEth == null) {
                $scope.objDomainSale.price = 0;
        } else { 
            $scope.objDomainSale.price = etherUnits.toWei($scope.objDomainSale.priceEth, 'ether');
        }
    }
    $scope.syncReserve = function() {
        if ($scope.objDomainSale.reserveEth == null) {
                $scope.objDomainSale.reserve = 0;
        } else { 
            $scope.objDomainSale.reserve = etherUnits.toWei($scope.objDomainSale.reserveEth, 'ether');
        }
    }
    $scope.syncBid = function() {
        if ($scope.objDomainSale.bidEth == null) {
                $scope.objDomainSale.bid = 0;
        } else { 
            $scope.objDomainSale.bid = etherUnits.toWei($scope.objDomainSale.bidEth, 'ether');
        }
    }

    $scope.sendTxStatus = "";
    $scope.sendTx = function() {
        $scope.domainsaleConfirmModalModal.close();
        $scope.objDomainSale.status = -1;
        var signedTx = $scope.generatedTxs.shift();
        uiFuncs.sendTx(signedTx, function(resp) {
            if (!resp.isError) {
                var emailLink = '<a class="strong" href="mailto:support@myetherwallet.com?subject=Issue%20regarding%20my%20DomainSale%20&body=Hi%20Taylor%2C%20%0A%0AI%20have%20a%20question%20concerning%20my%20DomainSale%20transaction.%20%0A%0AI%20was%20attempting%20to%3A%0A-%20Start%20an%20ENS%20auction%0A-%20Bid%20on%20an%20ENS%20name%0A-%20Reveal%20my%20ENS%20bid%0A-%20Finalize%20my%20ENS%20name%0A%0AUnfortunately%20it%3A%0A-%20Never%20showed%20on%20the%20blockchain%0A-%20Failed%20due%20to%20out%20of%20gas%0A-%20Failed%20for%20another%20reason%0A-%20Never%20showed%20up%20in%20the%20account%20I%20was%20sending%20to%0A%0APlease%20see%20the%20below%20details%20for%20additional%20information.%0A%0AThank%20you.%20%0A%0A_%0A%0A%20name%3A%20' + $scope.objDomainSale.name + "%0A%20txSent%3A%20" + $scope.objDomainSale.txSent + "%0A%20to%3A%20" + $scope.tx.to + "%0A%20from%20address%3A%20" + $scope.wallet.getAddressString() + "%0A%20data%3A%20" + $scope.tx.data + "%0A%20value%3A%20" + $scope.tx.value + '" rel="noopener">Confused? Email Us.</a>';
                var bExStr = $scope.ajaxReq.type != nodes.nodeTypes.Custom ? "<a class='strong' href='" + $scope.ajaxReq.blockExplorerTX.replace("[[txHash]]", resp.data) + "' target='_blank' rel='noopener'> View your transaction </a>" : '';
                $scope.sendTxStatus += globalFuncs.successMsgs[2] + "<p>" + resp.data + "</p><p>" + bExStr + "</p><p>" + emailLink + "</p>";
                $scope.notifier.success($scope.sendTxStatus);
                if ($scope.generatedTxs.length) $scope.sendTx();
                else $scope.sendTxStatus = ''
            } else {
                $scope.notifier.danger(resp.error);
            }
        });
        $scope.objDomainSale.txSent = true;
        $scope.hideDomainSaleInfoPanel = false;
    }
    $scope.generateTransferTx = function() {
        try {
            $scope.objDomainSale.tx = domainsale.transactions.transfer;
            $scope.sentTxs = [];
            $scope.generatedTxs = [];
            if (!$scope.Validator.isValidENSName($scope.objDomainSale.name)) throw globalFuncs.errorMsgs[30];
            $scope.transferTx();
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.transferTx = function(nonce, gasPrice) {
        $scope.tx.gasLimit = $scope.gasLimitDefaults.transfer;
        var _objDomainSale = $scope.objDomainSale;

        // N.B. Transfer instruction is to ENS registrar
        $scope.tx.data = ENS.getTransferData(_objDomainSale.name, DomainSale.getContractAddress());
        $scope.tx.to = ENS.getAuctionAddress();
        $scope.tx.value = 0;
        var txData = uiFuncs.getTxData($scope);
        if (nonce && gasPrice) {
            txData.nonce = nonce;
            txData.gasPrice = gasPrice;
        } else {
            txData.nonce = txData.gasPrice = null;
        }
        uiFuncs.generateTx(txData, function(rawTx) {
            if (!rawTx.isError) {
                $scope.generatedTxs.push(rawTx.signedTx);
                $scope.domainsaleConfirmModalModal.open();
            } else {
                $scope.notifier.danger(rawTx.error);
            }
            if (!$scope.$$phase) $scope.$apply();
        });
    }
    $scope.generateOfferTx = function() {
        try {
            $scope.objDomainSale.tx = domainsale.transactions.offer;
            $scope.sentTxs = [];
            $scope.generatedTxs = [];
            if (!$scope.Validator.isValidENSName($scope.objDomainSale.name)) throw globalFuncs.errorMsgs[30];
            // TODO confirm that bid or price is > 0
            $scope.offerTx();
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.offerTx = function(nonce, gasPrice) {
        $scope.tx.gasLimit = $scope.gasLimitDefaults.offer;
        var _objDomainSale = $scope.objDomainSale;

        $scope.tx.data = DomainSale.getOfferData(_objDomainSale.name, _objDomainSale.price, _objDomainSale.reserve, $scope.referrer);
        $scope.tx.to = DomainSale.getContractAddress();
        $scope.tx.value = 0;
        var txData = uiFuncs.getTxData($scope);
        if (nonce && gasPrice) {
            txData.nonce = nonce;
            txData.gasPrice = gasPrice;
        } else {
            txData.nonce = txData.gasPrice = null;
        }
        uiFuncs.generateTx(txData, function(rawTx) {
            if (!rawTx.isError) {
                $scope.generatedTxs.push(rawTx.signedTx);
                $scope.domainsaleConfirmModalModal.open();
            } else {
                $scope.notifier.danger(rawTx.error);
            }
            if (!$scope.$$phase) $scope.$apply();
        });
    }
    $scope.generateBuyTx = function() {
        try {
            $scope.objDomainSale.tx = domainsale.transactions.buy;
            $scope.sentTxs = [];
            $scope.generatedTxs = [];
            if (!$scope.Validator.isValidENSName($scope.objDomainSale.name)) throw globalFuncs.errorMsgs[30];
            // TODO confirm that buy price is > 0
            $scope.tx.gasLimit = $scope.gasLimitDefaults.buy;
            $scope.tx.data = DomainSale.getBuyData($scope.objDomainSale.name, $scope.referrer);
            $scope.tx.value = $scope.objDomainSale.price;
            $scope.doTx();
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.doTx = function(nonce, gasPrice) {
        $scope.tx.to = DomainSale.getContractAddress();
        var txData = uiFuncs.getTxData($scope);
        if (nonce && gasPrice) {
            txData.nonce = nonce;
            txData.gasPrice = gasPrice;
        } else {
            txData.nonce = txData.gasPrice = null;
        }
        uiFuncs.generateTx(txData, function(rawTx) {
            if (!rawTx.isError) {
                $scope.generatedTxs.push(rawTx.signedTx);
                $scope.domainsaleConfirmModalModal.open();
            } else {
                $scope.notifier.danger(rawTx.error);
            }
            if (!$scope.$$phase) $scope.$apply();
        });
    }
    $scope.generateTx = function() {
        try {
            var _objDomainSale = $scope.objDomainSale;
            $scope.sentTxs = [];
            $scope.generatedTxs = [];
            if (!$scope.Validator.isValidENSName(_objDomainSale.name)) throw globalFuncs.errorMsgs[30];
            else if (!$scope.Validator.isPositiveNumber(_objDomainSale.bidValue) || _objENS.bidValue < 0.01) throw globalFuncs.errorMsgs[0];
            else if (_objENS.status != $scope.ensModes.reveal && (!$scope.Validator.isPositiveNumber(_objENS.dValue) || _objENS.dValue < _objENS.bidValue || $scope.wallet.balance <= _objENS.dValue)) throw globalFuncs.errorMsgs[0];
            else if (!$scope.Validator.isPasswordLenValid(_objENS.secret, 0)) throw globalFuncs.errorMsgs[31];
            else if (_objENS.revealObject && _objENS.revealObject.name && ens.normalise(_objENS.revealObject.name) != _objENS.name) throw globalFuncs.errorMsgs[34];
            else {
                if ($scope.objENS.status == $scope.ensModes.open) $scope.openAndBidAuction();
                else if ($scope.objENS.status == $scope.ensModes.auction) $scope.bidAuction();
                else if ($scope.objENS.status == $scope.ensModes.reveal) $scope.revealBid();
            }
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
}
module.exports = domainsaleCtrl;
