#!/bin/bash
# This is a very basic integration test that ensures that the nodecg-io cli can be used
# to install nodecg-io to a NodeCG installation and (if a production installation is used)
# succesfully generate a new bundle.
# This is cun in a matrix in CI to ensure that it works for windows and ubuntu
# and with all supported nodecg-io versions.
set -e

version="$1"
if [ -z "$version" ]; then
  echo "Usage: integration_test.sh <nodecg-io-version>"
  exit 1
fi

dir=$(mktemp -d)

echo "Test directory: $dir"
function clean_test_directory {
    echo "Cleaning test directory at $dir"
    rm -rf $dir
}
trap clean_test_directory EXIT

cd $dir
git clone https://github.com/nodecg/nodecg.git --depth 1 .

if [ "$version" == "development" ]; then
    nodecg-io install --nodecg-io-version $version --docs
else
    # Install nodecg-io
    nodecg-io install --nodecg-io-version $version --all-services

    # Generate a bundle that uses all available services
    input="test\\n\n\\n\\na\\n\\n\\n\\n"
    # We add a sleep of 500ms between each line so that stdin pauses and inquirer 
    # thinks the user is done, reads and processes the input instead of assuming multi-line input.
    echo -en "$input" | while read -r line; do echo "$line"; sleep 1.5; done | nodecg-io generate
fi

nodecg-io uninstall

